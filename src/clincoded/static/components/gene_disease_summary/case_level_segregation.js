'use strict';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { external_url_map } from '../globals';

class GeneDiseaseEvidenceSummarySegregation extends Component {
    constructor(props) {
        super(props);
        this.state = {
            segregationEvidenceList: this.props.segregationEvidenceList,
            hpoTermList: this.props.hpoTermList
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.segregationEvidenceList) {
            this.setState({segregationEvidenceList: nextProps.segregationEvidenceList});
        }
        if (nextProps.hpoTermList && nextProps.hpoTermList.length) {
            this.setState({hpoTermList: nextProps.hpoTermList});
        }
    }

    /**
     * Method to render individual table row of the logged-in user's segregation evidence
     * @param {object} evidence - segregation evidence with LOD score but without proband
     * @param {number} key - unique key
     */
    renderSegregationEvidence(evidence, key) {
        return (
            <tr key={key} className="scored-segregation-evidence">
                <td className="evidence-reference">
                    <span>{evidence.authors.join(', ')}, <strong>{evidence.pubYear}</strong>, <a href={external_url_map['PubMed'] + evidence.pmid} target="_blank">PMID: {evidence.pmid}</a></span>
                </td>
                <td className="evidence-ethnicity">
                    {evidence.ethnicity}
                </td>
                <td className="evidence-phenotypes">
                    {evidence.hpoIdInDiagnosis.length ? <span><strong>HPO term(s):</strong> {this.state.hpoTermList.join(', ')}</span> : null}
                    {evidence.hpoIdInDiagnosis.length && evidence.termsInDiagnosis.length ? <span>; </span> : null}
                    {evidence.termsInDiagnosis.length ? <span><strong>free text:</strong> {evidence.termsInDiagnosis}</span> : null}
                </td>
                <td className="evidence-segregation-num-affected">
                    {evidence.segregationNumAffected}
                </td>
                <td className="evidence-segregation-num-unaffected">
                    {evidence.segregationNumUnaffected}
                </td>
                <td className="evidence-lod-score">
                    {evidence.segregationPublishedLodScore ?
                        <span><strong>Published:</strong> {evidence.segregationPublishedLodScore}</span>
                        : 
                        (evidence.segregationEstimatedLodScore ? <span><strong>Calculated:</strong> {evidence.segregationEstimatedLodScore}</span> : '-')
                    }
                </td>
                <td className="evidence-lod-score-counted">
                    {evidence.segregationPublishedLodScore || evidence.segregationEstimatedLodScore ? <span>{evidence.includeLodScoreInAggregateCalculation ? 'Yes' : 'No'}</span> : '-'}
                </td>
            </tr>
        );
    }

    /**
     * Method to get the total score of all scored evidence
     * @param {array} evidenceList - A list of evidence items
     */
    getTotalScore(evidenceList) {
        let allScores = [];
        evidenceList.forEach(item => {
            let score;
            if (item.includeLodScoreInAggregateCalculation) {
                if (typeof item.segregationPublishedLodScore === 'number') {
                    score = item.segregationPublishedLodScore;
                } else if (typeof item.segregationEstimatedLodScore === 'number') {
                    score = item.segregationEstimatedLodScore;
                }
                allScores.push(score);
            }
        });
        const totalScore = allScores.reduce((a, b) => a + b, 0);
        return totalScore;
    }

    render() {
        const segregationEvidenceList = this.state.segregationEvidenceList;
        let self = this;

        return (
            <div className="evidence-summary panel-case-level-segregation">
                <div className="panel panel-info">
                    <div className="panel-heading">
                        <h3 className="panel-title">Genetic Evidence: Case Level (family segregation information without proband data)</h3>
                    </div>
                    {segregationEvidenceList && segregationEvidenceList.length ?
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Reference</th>
                                    <th>Family ethnicity</th>
                                    <th>Family phenotypes</th>
                                    <th>Number of affected individuals</th>
                                    <th>Number of unaffected individuals</th>
                                    <th>LOD score</th>
                                    <th>LOD score counted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {segregationEvidenceList.map((item, i) => {
                                    return (self.renderSegregationEvidence(item, i));
                                })}
                                <tr>
                                    <td colSpan="5" className="total-score-label">Total score:</td>
                                    <td colSpan="2" className="total-score-value">{this.getTotalScore(segregationEvidenceList)}</td>
                                </tr>
                            </tbody>
                        </table>
                        :
                        <div className="panel-body">
                            <span>No segregation evidence for a Family without a proband was found.</span>
                        </div>
                    }
                </div>
            </div>
        );
    }
}

GeneDiseaseEvidenceSummarySegregation.propTypes = {
    segregationEvidenceList: PropTypes.array,
    hpoTermList: PropTypes.array
};

export default GeneDiseaseEvidenceSummarySegregation;