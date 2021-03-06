'use strict';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import _ from 'underscore';
import url from 'url';
import { content_views, listing_titles, listing_views, statusOrder } from './globals';
import { AuditMixin, AuditIndicators, AuditDetail } from './audit';
import { DbxrefList, Dbxref } from './dbxref';

var image = require('./image');
var search = module.exports;

// Should really be singular...
var types = {
    gene: {title: 'Genes'},
    orphaPhenotype: {title: 'Diseases'},
    article: {title: 'References'},
    variant: {title: 'Variants'},
    gdm: {title: 'GDMs'},
    annotation: {title: 'Evidences'},
    group: {title: 'Groups'},
    family: {title: 'Families'},
    individual: {title: 'Individuals'},
    experimental: {title: 'Experimental Data'},
    assessment: {title: 'Assessments'},
    interpretation: {title: 'Interpretations'},
};

var Listing = module.exports.Listing = function (props) {
    // XXX not all panels have the same markup
    var context;
    if (props['@id']) {
        context = props;
        props = {context: context,  key: context['@id']};
    }
    var ListingView = listing_views.lookup(props.context);
    return <ListingView {...props} />;
};

var PickerActionsMixin = module.exports.PickerActionsMixin = {
    contextTypes: {actions: PropTypes.array},
    renderActions: function() {
        if (this.context.actions && this.context.actions.length) {
            return (
                <div className="pull-right">
                    {this.context.actions.map(action => React.cloneElement(action, {id: this.props.context['@id']}))}
                </div>
            );
        } else {
            return <span/>;
        }
    }
};

var Item = module.exports.Item = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;
        var title = listing_titles.lookup(result)({context: result});
        var item_type = result['@type'][0];
        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    {result.accession ?
                        <div className="pull-right type sentence-case search-meta">
                            <p>{item_type}: {' ' + result['accession']}</p>
                            <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                        </div>
                    : null}
                    <div className="accession">
                        <a href={result['@id']}>{title}</a>
                    </div>
                    <div className="data-row">
                        {result.description}
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Item, 'item');

// Display one antibody status indicator
var StatusIndicator = createReactClass({
    getInitialState: function() {
        return {
            tipOpen: false,
            tipStyles: {}
        };
    },

    // Display tooltip on hover
    onMouseEnter: function () {
        function getNextElementSibling(el) {
            // IE8 doesn't support nextElementSibling
            return el.nextElementSibling ? el.nextElementSibling : el.nextSibling;
        }

        // Get viewport bounds of result table and of this tooltip
        var whiteSpace = 'nowrap';
        var resultBounds = document.getElementById('result-table').getBoundingClientRect();
        var resultWidth = resultBounds.right - resultBounds.left;
        var tipBounds = _.clone(getNextElementSibling(this.refs.indicator).getBoundingClientRect());
        var tipWidth = tipBounds.right - tipBounds.left;
        var width = tipWidth;
        if (tipWidth > resultWidth) {
            // Tooltip wider than result table; set tooltip to result table width and allow text to wrap
            tipBounds.right = tipBounds.left + resultWidth - 2;
            whiteSpace = 'normal';
            width = tipBounds.right - tipBounds.left - 2;
        }

        // Set an inline style to move the tooltip if it runs off right edge of result table
        var leftOffset = resultBounds.right - tipBounds.right;
        if (leftOffset < 0) {
            // Tooltip goes outside right edge of result table; move it to the left
            this.setState({tipStyles: {left: (leftOffset + 10) + 'px', maxWidth: resultWidth + 'px', whiteSpace: whiteSpace, width: width + 'px'}});
        } else {
            // Tooltip fits inside result table; move it to native position
            this.setState({tipStyles: {left: '10px', maxWidth: resultWidth + 'px', whiteSpace: whiteSpace, width: width + 'px'}});
        }

        this.setState({tipOpen: true});
    },

    // Close tooltip when not hovering
    onMouseLeave: function() {
        this.setState({tipStyles: {maxWidth: 'none', whiteSpace: 'nowrap', width: 'auto', left: '15px'}}); // Reset position and width
        this.setState({tipOpen: false});
    },

    render: function() {
        var classes = this.state.tipOpen ? 'tooltipopen' : '';

        return (
            <span className="tooltip-trigger">
                <i className={statusClass(this.props.status, 'indicator icon icon-circle')} ref="indicator" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}></i>
                <div className={"tooltip sentence-case " + classes} style={this.state.tipStyles}>
                    {this.props.status}<br /><span>{this.props.terms.join(', ')}</span>
                </div>
            </span>
        );
    }
});

// Display the status indicators for one target
var StatusIndicators = createReactClass({
    render: function() {
        var targetTree = this.props.targetTree;
        var target = this.props.target;

        return (
            <span className="status-indicators">
                {Object.keys(targetTree[target]).map(function(status, i) {
                    if (status !== 'target') {
                        return <StatusIndicator key={i} status={status} terms={targetTree[target][status]} />;
                    } else {
                        return null;
                    }
                })}
            </span>
        );
    }
});

var Antibody = module.exports.Antibody = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;

        // Sort the lot reviews by their status according to our predefined order
        // given in the statusOrder array.
        var lot_reviews = _.sortBy(result.lot_reviews, function(lot_review) {
            return _.indexOf(statusOrder, lot_review.status); // Use underscore indexOf so that this works in IE8
        });

        // Build antibody display object as a hierarchy: target=>status=>biosample_term_names
        var targetTree = {};
        lot_reviews.forEach(function(lot_review) {
            lot_review.targets.forEach(function(target) {
                // If we haven't seen this target, save it in targetTree along with the
                // corresponding target and organism structures.
                if (!targetTree[target.name]) {
                    targetTree[target.name] = {target: target};
                }
                var targetNode = targetTree[target.name];

                // If we haven't seen the status, save it in the targetTree target
                if (!targetNode[lot_review.status]) {
                    targetNode[lot_review.status] = [];
                }
                var statusNode = targetNode[lot_review.status];

                // If we haven't seen the biosample term name, save it in the targetTree target status
                if (statusNode.indexOf(lot_review.biosample_term_name) === -1) {
                    statusNode.push(lot_review.biosample_term_name);
                }
            });
        });
        lot_reviews = null; // Tell GC we're done, just to be sure

        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Antibody</p>
                        <p className="type">{' ' + result.accession}</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        {Object.keys(targetTree).map(function(target) {
                            return (
                                <div key={target}>
                                    <a href={result['@id']}>
                                        {targetTree[target].target.label}
                                        {targetTree[target].target.organism ? <span>{' ('}<i>{targetTree[target].target.organism.scientific_name}</i>{')'}</span> : ''}
                                    </a>
                                    <StatusIndicators targetTree={targetTree} target={target} />
                                </div>
                            );
                        })}
                    </div>
                    <div className="data-row">
                        <div><strong>Source: </strong>{result.source.title}</div>
                        <div><strong>Product ID / Lot ID: </strong>{result.product_id} / {result.lot_id}</div>
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Antibody, 'antibody_lot');

var Biosample = module.exports.Biosample = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;
        var lifeStage = (result['life_stage'] && result['life_stage'] != 'unknown') ? ' ' + result['life_stage'] : '';
        var age = (result['age'] && result['age'] != 'unknown') ? ' ' + result['age'] : '';
        var ageUnits = (result['age_units'] && result['age_units'] != 'unknown' && age) ? ' ' + result['age_units'] : '';
        var separator = (lifeStage || age) ? ',' : '';
        var rnais = (result.rnais[0] && result.rnais[0].target && result.rnais[0].target.label) ? result.rnais[0].target.label : '';
        var constructs;
        if (result.model_organism_donor_constructs && result.model_organism_donor_constructs.length) {
            constructs = result.model_organism_donor_constructs[0].target.label;
        } else {
            constructs = result.constructs[0] ? result.constructs[0].target.label : '';
        }
        var treatment = (result.treatments[0] && result.treatments[0].treatment_term_name) ? result.treatments[0].treatment_term_name : '';
        var mutatedGenes = result.donor && result.donor.mutated_gene && result.donor.mutated_gene.label;

        // Build the text of the synchronization string
        var synchText;
        if (result.synchronization) {
            synchText = result.synchronization +
                (result.post_synchronization_time ?
                    ' + ' + result.post_synchronization_time + (result.post_synchronization_time_units ? ' ' + result.post_synchronization_time_units : '')
                : '');
        }

        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Biosample</p>
                        <p className="type">{' ' + result['accession']}</p>
                        <p className="type meta-status">{' ' + result['status']}</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        <a href={result['@id']}>
                            {result['biosample_term_name'] + ' ('}
                            <em>{result.organism.scientific_name}</em>
                            {separator + lifeStage + age + ageUnits + ')'}
                        </a>
                    </div>
                    <div className="data-row">
                        <div><strong>Type: </strong>{result['biosample_type']}</div>
                        {rnais ?<div><strong>RNAi target: </strong>{rnais}</div> : null}
                        {constructs ? <div><strong>Construct: </strong>{constructs}</div> : null}
                        {treatment ? <div><strong>Treatment: </strong>{treatment}</div> : null}
                        {mutatedGenes ? <div><strong>Mutated gene: </strong>{mutatedGenes}</div> : null}
                        {result.culture_harvest_date ? <div><strong>Culture harvest date: </strong>{result.culture_harvest_date}</div> : null}
                        {result.date_obtained ? <div><strong>Date obtained: </strong>{result.date_obtained}</div> : null}
                        {synchText ? <div><strong>Synchronization timepoint: </strong>{synchText}</div> : null}
                        <div><strong>Source: </strong>{result.source.title}</div>
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Biosample, 'biosample');


var Experiment = module.exports.Experiment = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;

        // Make array of scientific names from replicates; remove all duplicates
        var names = _.uniq(result.replicates.map(function(replicate) {
            return (replicate.library && replicate.library.biosample && replicate.library.biosample.organism &&
                    replicate.library.biosample.organism) ? replicate.library.biosample.organism.scientific_name : undefined;
        }));
        var name = (names.length === 1 && names[0] && names[0] !== 'unknown') ? names[0] : '';

        // Make array of life stages from replicates; remove all duplicates
        var lifeStages = _.uniq(result.replicates.map(function(replicate) {
            return (replicate.library && replicate.library.biosample) ? replicate.library.biosample.life_stage : undefined;
        }));
        var lifeStage = (lifeStages.length === 1 && lifeStages[0] && lifeStages[0] !== 'unknown') ? ' ' + lifeStages[0] : '';

        // Make array of ages from replicates; remove all duplicates
        var ages = _.uniq(result.replicates.map(function(replicate) {
            return (replicate.library && replicate.library.biosample) ? replicate.library.biosample.age : undefined;
        }));
        var age = (ages.length === 1 && ages[0] && ages[0] !== 'unknown') ? ' ' + ages[0] : '';

        // Collect synchronizations
        var synchronizations = _.uniq(result.replicates.filter(function(replicate) {
            return (replicate.library && replicate.library.biosample && replicate.library.biosample.synchronization);
        }).map(function(replicate) {
            var biosample = replicate.library.biosample;
            return (biosample.synchronization +
                (biosample.post_synchronization_time ?
                    ' + ' + biosample.post_synchronization_time + (biosample.post_synchronization_time_units ? ' ' + biosample.post_synchronization_time_units : '')
                : ''));
        }));

        // Make array of age units from replicates; remove all duplicates
        var ageUnit = '';
        if (age) {
            var ageUnits = _.uniq(result.replicates.map(function(replicate) {
                return (replicate.library && replicate.library.biosample) ? replicate.library.biosample.age_units : undefined;
            }));
            ageUnit = (ageUnits.length === 1 && ageUnits[0] && ageUnits[0] !== 'unknown') ? ' ' + ageUnits[0] : '';
        }

        // If we have life stage or age, need to separate from scientific name with comma
        var separator = (lifeStage || age) ? ', ' : '';

        // Get the first treatment if it's there
        var treatment = (result.replicates[0] && result.replicates[0].library && result.replicates[0].library.biosample &&
                result.replicates[0].library.biosample.treatments[0]) ? result.replicates[0].library.biosample.treatments[0].treatment_term_name : '';

        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Experiment</p>
                        <p className="type">{' ' + result['accession']}</p>
                        <p className="type meta-status">{' ' + result['status']}</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        <a href={result['@id']}>
                            {result['assay_term_name']}<span>{result['biosample_term_name'] ? ' of ' + result['biosample_term_name'] : ''}</span>
                            {name || lifeStage || age || ageUnit ?
                                <span>
                                    {' ('}
                                    {name ? <em>{name}</em> : ''}
                                    {separator + lifeStage + age + ageUnit + ')'}
                                </span>
                            : ''}
                        </a>
                    </div>
                    <div className="data-row">
                        {result.target && result.target.label ?
                            <div><strong>Target: </strong>{result.target.label}</div>
                        : null}

                        {treatment ?
                            <div><strong>Treatment: </strong>{treatment}</div>
                        : null}

                        {synchronizations && synchronizations.length ?
                            <div><strong>Synchronization timepoint: </strong>{synchronizations.join(', ')}</div>
                        : null}

                        <div><strong>Lab: </strong>{result.lab.title}</div>
                        <div><strong>Project: </strong>{result.award.project}</div>
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Experiment, 'experiment');

var Dataset = module.exports.Dataset = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;
        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Dataset</p>
                        <p className="type">{' ' + result['accession']}</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        <a href={result['@id']}>{result['description']}</a>
                    </div>
                    <div className="data-row">
                        {result['dataset_type'] ? <div><strong>Dataset type: </strong>{result['dataset_type']}</div> : null}
                        <div><strong>Lab: </strong>{result.lab.title}</div>
                        <div><strong>Project: </strong>{result.award.project}</div>
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Dataset, 'dataset');

var Target = module.exports.Target = createReactClass({
    mixins: [PickerActionsMixin, AuditMixin],
    render: function() {
        var result = this.props.context;
        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Target</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        <a href={result['@id']}>
                            {result['label']}
                            {result.organism && result.organism.scientific_name ? <em>{' (' + result.organism.scientific_name + ')'}</em> : null}
                        </a>
                    </div>
                    <div className="data-row">
                        <strong>External resources: </strong>
                        {result.dbxref && result.dbxref.length ?
                            <DbxrefList values={result.dbxref} target_gene={result.gene_name} />
                        : <em>None submitted</em> }
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Target, 'target');


var Image = module.exports.Image = createReactClass({
    mixins: [PickerActionsMixin, ],
    render: function() {
        var result = this.props.context;
        var Attachment = image.Attachment;
        return (
            <li>
                <div className="clearfix">
                    {this.renderActions()}
                    <div className="pull-right search-meta">
                        <p className="type meta-title">Image</p>
                        <AuditIndicators audits={result.audit} id={this.props.context['@id']} search />
                    </div>
                    <div className="accession">
                        <a href={result['@id']}>{result.caption}</a>
                    </div>
                    <div className="data-row">
                        <Attachment context={result} />
                    </div>
                </div>
                <AuditDetail context={result} id={this.props.context['@id']} forcedEditLink />
            </li>
        );
    }
});
listing_views.register(Image, 'image');


// If the given term is selected, return the href for the term
function termSelected(term, field, filters) {
    for (var filter in filters) {
        if (filters[filter]['field'] == field && filters[filter]['term'] == term) {
            return url.parse(filters[filter]['remove']).search;
        }
    }
    return null;
}

// Determine whether any of the given terms are selected
function countSelectedTerms(terms, field, filters) {
    var count = 0;
    for(var oneTerm in terms) {
        if(termSelected(terms[oneTerm].key, field, filters)) {
            count++;
        }
    }
    return count;
}

var Term = search.Term = createReactClass({
    render: function () {
        var filters = this.props.filters;
        var term = this.props.term['key'];
        var count = this.props.term['doc_count'];
        var title = this.props.title || term;
        var field = this.props.facet['field'];
        var em = field === 'target.organism.scientific_name' ||
                 field === 'organism.scientific_name' ||
                 field === 'replicates.library.biosample.donor.organism.scientific_name';
        var barStyle = {
            width:  Math.ceil( (count/this.props.total) * 100) + "%"
        };
        var selected = termSelected(term, field, filters);
        var href;
        if (selected && !this.props.canDeselect) {
            href = null;
        } else if (selected) {
            href = selected;
        } else {
            href = this.props.searchBase + field + '=' + term;
        }
        return (
            <li id={selected ? "selected" : ""} key={term}>
                {selected ? '' : <span className="bar" style={barStyle}></span>}
                {field === 'lot_reviews.status' ? <span className={statusClass(term, 'indicator pull-left facet-term-key icon icon-circle')}></span> : null}
                <a id={selected ? "selected" : ""} href={href} onClick={href ? this.props.onFilter : null}>
                    <span className="pull-right">{count} {selected && this.props.canDeselect ? <i className="icon icon-times-circle-o"></i> : ''}</span>
                    <span className="facet-item">
                        {em ? <em>{title}</em> : <span>{title}</span>}
                    </span>
                </a>
            </li>
        );
    }
});

var TypeTerm = search.TypeTerm = createReactClass({
    render: function () {
        var term = this.props.term['key'];
        var filters = this.props.filters;
        var title;
        try {
            title = types[term].title;
        } catch (e) {
            title = term;
        }
        var total = this.props.total;
        return <Term {...this.props} title={title} filters={filters} total={total} />;
    }
});


var Facet = search.Facet = createReactClass({
    getInitialState: function () {
        return {
            facetOpen: false
        };
    },

    handleClick: function () {
        this.setState({facetOpen: !this.state.facetOpen});
    },

    render: function() {
        var facet = this.props.facet;
        var filters = this.props.filters;
        var title = facet['title'];
        var field = facet['field'];
        var total = facet['total'];
        var termID = title.replace(/\s+/g, '');
        var terms = facet['terms'].filter(function (term) {
            if (term.key) {
                for(var filter in filters) {
                    if(filters[filter].term === term.key) {
                        return true;
                    }
                }
                return term.doc_count > 0;
            } else {
                return false;
            }
        });
        var TermComponent = field === 'type' ? TypeTerm : Term;
        var selectedTermCount = countSelectedTerms(terms, field, filters);
        return (
            <div className="facet" hidden={terms.length === 0}>
                <h5>{title}</h5>
                <ul className="facet-list nav">
                    <div>
                        {terms.map(function (term) {
                            return <TermComponent {...this.props} key={term.key} term={term} filters={filters} total={total} />;
                        }.bind(this))}
                    </div>
                </ul>
            </div>
        );
    }
});

var TextFilter = createReactClass({

    getValue: function(props) {
        var filter = this.props.filters.filter(function(f) {
            return f.field == 'searchTerm';
        });
        return filter.length ? filter[0].term : '';
    },

    shouldUpdateComponent: function(nextProps) {
        return (this.getValue(this.props) != this.getValue(nextProps));
    },

    render: function() {
        return (
            <div className="facet">
                <input ref="input" type="search" className="form-control search-query"
                       placeholder="Enter search term(s)"
                       defaultValue={this.getValue(this.props)}
                       onChange={this.onChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown} />
            </div>
        );
    },

    onChange: function(e) {
        e.stopPropagation();
        e.preventDefault();
    },

    onBlur: function(e) {
        var search = this.props.searchBase.replace(/&?searchTerm=[^&]*/, '');
        var value = e.target.value;
        if (value) {
            search += 'searchTerm=' + e.target.value;
        } else {
            search = search.substring(0, search.length - 1);
        }
        this.props.onChange(search);
    },

    onKeyDown: function(e) {
        if (e.keyCode == 13) {
            this.onBlur(e);
            e.preventDefault();
        }
    }
});

var FacetList = search.FacetList = createReactClass({
    render: function() {
        var term = this.props.term;
        var facets = this.props.facets;
        var filters = this.props.filters;
        if (!facets.length && this.props.mode != 'picker') return <div />;
        var hideTypes;
        if (this.props.mode == 'picker') {
            hideTypes = false;
        } else {
            hideTypes = filters.filter(function(filter) {
                return filter.field == 'type';
            }).length;
        }
        return (
            <div className="box facets">
                {this.props.mode === 'picker' ? <TextFilter {...this.props} filters={filters} /> : ''}
                {facets.map(function (facet) {
                    if (hideTypes && facet.field == 'type') {
                        return <span key={facet.field} />;
                    } else {
                        return <Facet {...this.props} key={facet.field} facet={facet} filters={filters} />;
                    }
                }.bind(this))}
            </div>
        );
    }
});

var ResultTable = search.ResultTable = createReactClass({

    getDefaultProps: function() {
        return {
            restrictions: {},
            searchBase: ''
        };
    },

    childContextTypes: {actions: PropTypes.array},
    getChildContext: function() {
        return {
            actions: this.props.actions
        };
    },

    render: function() {
        var context = this.props.context;
        var results = context['@graph'];
        var facets = context['facets'];
        var total = context['total'];
        var batch_hub_disabled = total > 500;
        var columns = context['columns'];
        var filters = context['filters'];
        var label = 'results';
        var searchBase = this.props.searchBase;
        var trimmedSearchBase = searchBase.replace(/[\?|\&]limit=all/, "");
        _.each(facets, function(facet) {
            if (this.props.restrictions[facet.field] !== undefined) {
                facet.restrictions = this.props.restrictions[facet.field];
                facet.terms = facet.terms.filter(function(term) {
                    return _.contains(facet.restrictions, term.key);
                }.bind(this));
            }
        }.bind(this));

        // See if a specific result type was requested ('type=x')
        // Satisfied iff exactly one type is in the search
        if (results.length) {
            var specificFilter;
            filters.forEach(function(filter) {
                if (filter.field === 'type') {
                    specificFilter = specificFilter ? '' : filter.term;
                }
            });
            if (typeof specificFilter === 'string' && specificFilter.length) {
                label = results[0]['@id'].split('/')[1].replace(/-/g, ' ');
            }
        }

        return (
                <div>
                    <div className="row">
                        <div className="col-sm-5 col-md-4 col-lg-3">
                            <FacetList {...this.props} facets={facets} filters={filters}
                                       searchBase={searchBase ? searchBase + '&' : searchBase + '?'} onFilter={this.onFilter} />
                        </div>
                        <div className="col-sm-7 col-md-8 col-lg-9">
                            {context['notification'] === 'Success' ?
                                <h4>
                                    Showing {results.length} of {total} {label}
                                    {total > results.length && searchBase.indexOf('limit=all') === -1 ?
                                        <span className="pull-right">
                                            <a rel="nofollow" className="btn btn-info btn-sm"
                                                 href={searchBase ? searchBase + '&limit=all' : '?limit=all'}
                                                 onClick={this.onFilter}>View All</a>
                                        </span>
                                    :
                                        <span>
                                            {results.length > 25 ?
                                                <span className="pull-right">
                                                    <a className="btn btn-info btn-sm"
                                                       href={trimmedSearchBase ? trimmedSearchBase : "/search/"}
                                                       onClick={this.onFilter}>View 25</a>
                                                </span>
                                            : null}
                                        </span>
                                    }

                                    {context['batch_hub'] ?
                                        <span className="pull-right">
                                            <a disabled={batch_hub_disabled} data-bypass="true" target="_blank" private-browsing="true" className="btn btn-info btn-sm"
                                               href={context['batch_hub']}>{batch_hub_disabled ? 'Filter to 500 to visualize' :'Visualize'}</a>&nbsp;
                                        </span>
                                    :null}
                                </h4>
                            :
                                <h4>{context['notification']}</h4>
                            }
                            <hr />
                            <ul className="nav result-table" id="result-table">
                                {results.length ?
                                    results.map(function (result) {
                                        return Listing({context:result, columns: columns, key: result['@id']});
                                    })
                                : null}
                            </ul>
                        </div>
                    </div>
                </div>
        );
    },

    onFilter: function(e) {
        var search = e.currentTarget.getAttribute('href');
        this.props.onChange(search);
        e.stopPropagation();
        e.preventDefault();
    }
});

var Search = search.Search = createReactClass({
    render: function() {
        var context = this.props.context;
        var results = context['@graph'];
        var notification = context['notification'];
        var searchBase = url.parse(this.props.href).search || '';
        var facetdisplay = context.facets.some(function(facet) {
            return facet.total > 0;
        });
        return (
            <div>
                {facetdisplay ?
                    <div className="panel data-display main-panel">
                        <ResultTable {...this.props} key={undefined} searchBase={searchBase} onChange={this.props.navigate} />
                    </div>
                : <h4>{notification}</h4>}
            </div>
        );
    }
});

content_views.register(Search, 'search');
