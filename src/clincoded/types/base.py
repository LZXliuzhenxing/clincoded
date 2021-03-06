from functools import lru_cache
from pyramid.security import (
    ALL_PERMISSIONS,
    Allow,
    Authenticated,
    Deny,
    DENY_ALL,
    Everyone,
)
from pyramid.threadlocal import get_current_request
from pyramid.traversal import (
    find_root,
    traverse,
)
import contentbase
from ..schema_formats import is_accession


@lru_cache()
def _award_viewing_group(award_uuid, root):
    award = root.get_by_uuid(award_uuid)
    return award.upgrade_properties().get('viewing_group')


ALLOW_EVERYONE_VIEW = [
    (Allow, Everyone, 'view'),
]

ALLOW_SUBMITTER_ADD = [
    (Allow, 'group.submitter', 'add')
]

ALLOW_VIEWING_GROUP_VIEW = [
    (Allow, 'role.viewing_group_member', 'view'),
]

ALLOW_LAB_SUBMITTER_EDIT = [
    (Allow, 'role.viewing_group_member', 'view'),
    (Allow, 'group.admin', 'edit'),
    (Allow, 'role.lab_submitter', 'edit'),
]

ALLOW_CURRENT = [
    (Allow, 'group.curator', ALL_PERMISSIONS),
    (Allow, 'group.admin', ALL_PERMISSIONS)
]

ALLOW_CURRENT_NOVIEW = [
    (Deny, 'group.curator', ['view', 'edit']),
    (Allow, 'group.admin', ALL_PERMISSIONS),
    # Avoid schema validation errors during audit
    (Allow, 'remoteuser.EMBED', ['view', 'expand', 'audit', 'import_items']),
    (Allow, 'remoteuser.INDEXER', ['view', 'index']),
    DENY_ALL,
]

ONLY_ADMIN_VIEW = [
    (Allow, 'group.admin', ALL_PERMISSIONS),
    (Allow, 'group.read-only-admin', ['view']),
    # Avoid schema validation errors during audit
    (Allow, 'remoteuser.EMBED', ['view', 'expand', 'audit', 'import_items']),
    (Allow, 'remoteuser.INDEXER', ['view', 'index']),
    DENY_ALL,
]

DELETED = [
    (Deny, Everyone, 'visible_for_edit')
] + ONLY_ADMIN_VIEW


def paths_filtered_by_status(request, paths, exclude=('deleted', 'replaced'), include=None):
    if include is not None:
        return [
            path for path in paths
            if traverse(request.root, path)['context'].__json__(request).get('status') in include
        ]
    else:
        return [
            path for path in paths
            if traverse(request.root, path)['context'].__json__(request).get('status') not in exclude
        ]


class Collection(contentbase.Collection):
    def __init__(self, *args, **kw):
        super(Item.Collection, self).__init__(*args, **kw)
        if hasattr(self, '__acl__'):
            return
        # XXX collections should be setup after all types are registered.
        # Don't access type_info.schema here as that precaches calculated schema too early.
        if 'lab' in self.type_info.factory.schema['properties']:
            self.__acl__ = ALLOW_SUBMITTER_ADD

    def get(self, name, default=None):
        resource = super(Collection, self).get(name, None)
        if resource is not None:
            return resource
        if is_accession(name):
            resource = self.connection.get_by_unique_key('accession', name)
            if resource is not None:
                if resource.collection is not self and resource.__parent__ is not self:
                    return default
                return resource
        if ':' in name:
            resource = self.connection.get_by_unique_key('alias', name)
            if resource is not None:
                if resource.collection is not self and resource.__parent__ is not self:
                    return default
                return resource
        return default


class Item(contentbase.Item):
    Collection = Collection
    STATUS_ACL = {
        # standard_status
        'in progress': ALLOW_CURRENT,
        'released': ALLOW_CURRENT,
        'deleted': ALLOW_CURRENT_NOVIEW,
        'replaced': DELETED,
    }

    @property
    def __name__(self):
        if self.name_key is None:
            return self.uuid
        properties = self.upgrade_properties()
        if properties.get('status') == 'replaced':
            return self.uuid
        return properties.get(self.name_key, None) or self.uuid

    def __acl__(self):
        # Don't finalize to avoid validation here.
        properties = self.upgrade_properties().copy()
        status = properties.get('status')
        return self.STATUS_ACL.get(status, ALLOW_CURRENT)

    def __ac_local_roles__(self):
        roles = {}
        properties = self.upgrade_properties().copy()
        if 'lab' in properties:
            lab_submitters = 'submits_for.%s' % properties['lab']
            roles[lab_submitters] = 'role.lab_submitter'
        if 'award' in properties:
            viewing_group = _award_viewing_group(properties['award'], find_root(self))
            if viewing_group is not None:
                viewing_group_members = 'viewing_group.%s' % viewing_group
                roles[viewing_group_members] = 'role.viewing_group_member'
        return roles

    def unique_keys(self, properties):
        keys = super(Item, self).unique_keys(properties)
        if 'accession' not in self.schema['properties']:
            return keys
        keys.setdefault('accession', []).extend(properties.get('alternate_accessions', []))
        if properties.get('status') != 'replaced' and 'accession' in properties:
            keys['accession'].append(properties['accession'])
        return keys


class SharedItem(Item):
    ''' An Item visible to all authenticated users while "proposed" or "in progress".
    '''
    def __ac_local_roles__(self):
        roles = {}
        properties = self.upgrade_properties().copy()
        if 'lab' in properties:
            lab_submitters = 'submits_for.%s' % properties['lab']
            roles[lab_submitters] = 'role.lab_submitter'
        roles[Authenticated] = 'role.viewing_group_member'
        return roles


def contextless_has_permission(permission):
    request = get_current_request()
    return request.has_permission('forms', request.root)


@contentbase.calculated_property(context=Item.Collection, category='action')
def add(item_uri, item_type, has_permission):
    if has_permission('add') and contextless_has_permission('forms'):
        return {
            'name': 'add',
            'title': 'Add',
            'profile': '/profiles/{item_type}.json'.format(item_type=item_type),
            'href': '{item_uri}#!add'.format(item_uri=item_uri),
        }


@contentbase.calculated_property(context=Item, category='action')
def edit(item_uri, item_type, has_permission):
    if has_permission('edit') and contextless_has_permission('forms'):
        return {
            'name': 'edit',
            'title': 'Edit',
            'profile': '/profiles/{item_type}.json'.format(item_type=item_type),
            'href': item_uri + '#!edit',
        }


@contentbase.calculated_property(context=Item, category='action')
def edit_json(item_uri, item_type, has_permission):
    if has_permission('edit'):
        return {
            'name': 'edit-json',
            'title': 'Edit JSON',
            'profile': '/profiles/{item_type}.json'.format(item_type=item_type),
            'href': item_uri + '#!edit-json',
        }
