'use strict';
import React from 'react';
import moment from 'moment';
import { sortListByDate } from './helpers/sort';

/**
 * Method to render the provisional status of a given GDM's classification
 * @param {array} snapshots - List of snapshots associated with classification
 * @param {string} resourceType - A string value of either 'classification' or 'interpretation'
 * @param {object} gdm - The GDM object
 * @param {object} context - The global context object
 * @param {boolean} showLink - Whether to render link to view/approve provisional (gdm) or view provisional summary (interpretation)
 */
export function renderProvisionalStatus(snapshots, resourceType, gdm, context, showLink) {
    const sortedSnapshots = snapshots && snapshots.length ? sortListByDate(snapshots, 'date_created') : [];
    // Get any snapshots that had been provisioned
    const provisionedSnapshots = sortedSnapshots.filter(snapshot => {
        return snapshot.approvalStatus === 'Provisioned' && snapshot.resourceType === resourceType;
    });
    // Get any snapshots that had been approved
    const approvedSnapshots = sortedSnapshots.filter(snapshot => {
        return snapshot.approvalStatus === 'Approved' && snapshot.resourceType === resourceType;
    });
    let showProvisionalLink = false;
    if (resourceType === 'classification' && context && context.name === 'curation-central' && showLink) {
        showProvisionalLink = true;
    } else if (resourceType === 'interpretation' && showLink) {
        showProvisionalLink = true;
    }
    if (provisionedSnapshots && provisionedSnapshots.length && (!approvedSnapshots || (approvedSnapshots && !approvedSnapshots.length))) {
        return (
            <span className="status-wrapper provisional">
                <span className="label label-info status-item" data-toggle="tooltip" data-placement="top"
                    data-tooltip={'Provisioned on ' + moment(provisionedSnapshots[0].date_created).format("YYYY MMM DD, h:mm a")}>
                    PROVISIONAL
                </span>
                {showProvisionalLink ? renderProvisionalLink(provisionedSnapshots[0], resourceType, gdm) : null}
            </span>
        );
    } else {
        return null;
    }
}

/**
 * Method to render linkout to the evidence summary of a given approved classification or interpretation
 * @param {object} snapshot - The approved classification or interpretation snapshot
 * @param {string} resourceType - A string value of either 'classification' or 'interpretation'
 * @param {object} gdm - The GDM object
 */
function renderProvisionalLink(snapshot, resourceType, gdm) {
    if (resourceType === 'classification') {
        return (
            <span className="classification-link-item">
                <a href={'/provisional-classification/?gdm=' + gdm.uuid + '&approval=yes'} title="View/Approve Current Provisional"><i className="icon icon-link"></i></a>
            </span>
        );
    } else if (resourceType === 'interpretation') {
        return (
            <span className="classification-link-item">
                <a href={'/variant-interpretation-summary/?snapshot=' + snapshot.uuid} title="View Current Provisional" target="_blank"><i className="icon icon-link"></i></a>
            </span>
        );
    }
}