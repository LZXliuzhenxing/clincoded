'use strict';
var React = require('react');
var _ = require('underscore');
var moment = require('moment');
var globals = require('../../globals');
var RestMixin = require('../../rest').RestMixin;
var parseClinvar = require('../../../libs/parse-resources').parseClinvar;
var LocalStorageMixin = require('react-localstorage');
var SO_terms = require('./mapping/SO_term.json');

var external_url_map = globals.external_url_map;

// Display the curator data of the curation data
var CurationInterpretationBasicInfo = module.exports.CurationInterpretationBasicInfo = React.createClass({
    mixins: [RestMixin, LocalStorageMixin],

    propTypes: {
        data: React.PropTypes.object, // ClinVar data payload
        shouldFetchData: React.PropTypes.bool
    },

    getInitialState: function() {
        return {
            clinvar_id: null, // ClinVar ID
            car_id: null, // ClinGen Allele Registry ID
            dbSNP_id: null,
            nucleotide_change: [],
            molecular_consequence: [],
            protein_change: [],
            ensembl_transcripts: [],
            sequence_location: [],
            primary_transcript: {},
            hgvs_GRCh37: null,
            hgvs_GRCh38: null,
            gene_symbol: null,
            uniprot_id: null,
            shouldFetchData: false
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({shouldFetchData: nextProps.shouldFetchData});
        if (this.state.shouldFetchData === true) {
            this.fetchRefseqData();
            this.fetchEnsemblData();
        }
    },

    // Retrieve the variant data from NCBI REST API
    fetchRefseqData: function() {
        //var refseq_data = {};
        var variant = this.props.data;
        var url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=clinvar&rettype=variation&id=';
        if (variant) {
            var clinVarId = (variant.clinvarVariantId) ? variant.clinvarVariantId : 'Unknown';
            this.setState({
                clinvar_id: clinVarId,
                car_id: variant.carId,
                dbSNP_id: variant.dbSNPIds[0],
                hgvs_GRCh37: variant.hgvsNames.gRCh37,
                hgvs_GRCh37: variant.hgvsNames.gRCh37,
                hgvs_GRCh37: variant.hgvsNames.gRCh37,
                hgvs_GRCh38: variant.hgvsNames.gRCh38,
            });
            this.getRestDataXml(url + clinVarId).then(xml => {
                // Passing 'true' option to invoke 'mixin' function
                // To extract more ClinVar data for 'basic info' tab
                var d = parseClinvar(xml, true);
                this.setState({
                    nucleotide_change: d.RefSeqTranscripts.NucleotideChangeList,
                    protein_change: d.RefSeqTranscripts.ProteinChangeList,
                    molecular_consequence: d.RefSeqTranscripts.MolecularConsequenceList,
                    sequence_location: d.allele.SequenceLocation,
                    gene_symbol: d.gene.symbol
                });
                this.getUniprotId(this.state.gene_symbol);
                this.getPrimaryTranscript(d.clinvarVariantTitle, this.state.nucleotide_change, this.state.protein_change, this.state.molecular_consequence);
            }).catch(function(e) {
                console.log('RefSeq Fetch Error=: %o', e);
            });
        }
    },

    // Create primary transcript object
    // Called in the "fetchRefseqData" method after various states are set
    getPrimaryTranscript: function(str, nucleotide_change, protein_change, molecular_consequence) {
        var transcript = {}, SO_id_term = '';
        var result = nucleotide_change.find((n) => str.indexOf(n.AccessionVersion) > -1);
        if (result && molecular_consequence.length) {
            var item = molecular_consequence.find((x) => x.HGVS === result.HGVS);
            // 'SO_terms' is defined via requiring external mapping file
            var entry = SO_terms.find((v) => v.SO_id === item.SOid);
            SO_id_term = entry.SO_term + ' ' + entry.SO_id;
            // FIXME: temporarily use protein_change[0] due to lack of mapping
            // associated with nucleotide transcript in ClinVar data
            transcript = {
                "nucleotide": result.HGVS,
                "protein": protein_change[0].HGVS,
                "molecular": SO_id_term
            };
        }
        this.setState({primary_transcript: transcript});
    },

    // Retrieve variant data from Ensembl REST API
    fetchEnsemblData: function() {
        var variant = this.props.data;
        if (variant) {
            var rsid = (variant.dbSNPIds) ? variant.dbSNPIds[0] : 'Unknown';
            this.getRestData('http://rest.ensembl.org/vep/human/id/' + rsid + '?content-type=application/json&hgvs=1&protein=1&xref_refseq=1&domains=1').then(response => {
                this.setState({ensembl_transcripts: response[0].transcript_consequences});
            }).catch(function(e) {
                console.log('Ensembl Fetch Error=: %o', e);
            });
        }
    },

    // Use Ensembl consequence_terms to find matching SO_id and SO_term pair
    // Then concatenate all pairs into string
    handleSOTerms: function(array) {
        var newArray = [],
            SO_id_term,
            newStr = '';
        for (let value of array.values()) {
            // 'SO_terms' is defined via requiring external mapping file
            var entry = SO_terms.find((v) => v.SO_term === value);
            SO_id_term = entry.SO_term + ' ' + entry.SO_id;
            newArray.push(SO_id_term);
        }
        for (let [key, value] of newArray.entries()) {
            if (key === 0) {
                newStr += value;
            }
            if (key > 0) {
                newStr += ', ' + value;
            }
        }
        return newStr;
    },

    // Find gene_id from Ensembl REST API response
    // Used to construct LinkOut URL to Ensembl Browser
    getGeneId: function(array) {
        var gene_id = '';
        if (array.length && array[0].gene_id) {
            gene_id = array[0].gene_id;
        }
        return gene_id;
    },

    // Find Uniprot id given the gene_symbol from ClinVar
    // Called in the "fetchRefseqData" method after gene_symbol state is set
    // Used to construct LinkOut URL to Uniprot
    getUniprotId: function(gene_symbol) {
        if (gene_symbol) {
            this.getRestData('http://rest.genenames.org/fetch/symbol/' + gene_symbol).then(result => {
                this.setState({uniprot_id: result.response.docs[0].uniprot_ids[0]});
            }).catch(function(e) {
                console.log('HGNC Fetch Error=: %o', e);
            });
        }
    },

    // Construct LinkOut URLs to UCSC Viewer
    // For both GRCh38/hg38 and GRCh37/hg19
    ucscViewerURL: function(array, db, assembly) {
        var url = '';
        array.forEach(v => {
            if (v.Assembly === assembly) {
                url = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=' + db + '&position=Chr' + v.Chr + '%3A' + v.start + '-' + v.stop;
            }
        });
        return url;
    },

    // Construct LinkOut URLs to NCBI Variation Viewer
    // For both GRCh38 and GRCh37
    variationViewerURL: function(array, gene_symbol, assembly) {
        var url = '';
        array.forEach(v => {
            if (v.Assembly === assembly) {
                url = 'http://www.ncbi.nlm.nih.gov/variation/view/?chr=' + v.Chr + '&q=' + gene_symbol + '&assm=' + v.AssemblyAccessionVersion + '&from=' + v.start + '&to=' + v.stop;
            }
        });
        return url;
    },

    render: function() {
        var clinvar_id = this.state.clinvar_id;
        var car_id = this.state.car_id;
        var dbSNP_id = this.state.dbSNP_id;
        var nucleotide_change = this.state.nucleotide_change;
        var molecular_consequence = this.state.molecular_consequence;
        var protein_change = this.state.protein_change;
        var ensembl_data = this.state.ensembl_transcripts;
        var sequence_location = this.state.sequence_location;
        var gene_symbol = this.state.gene_symbol;
        var uniprot_id = this.state.uniprot_id;
        var GRCh37 = this.state.hgvs_GRCh37;
        var GRCh38 = this.state.hgvs_GRCh38;
        var primary_transcript = this.state.primary_transcript;
        var self = this;

        return (
            <div className="variant-interpretation basic-info">
                <div className="bs-callout bs-callout-info clearfix">
                    <div className="bs-callout-content-container">
                        <h4>IDs</h4>
                        <ul>
                            {(clinvar_id) ? <li><span>ClinVar Variation ID: {clinvar_id}</span></li> : null}
                            {(car_id) ? <li><span>ClinGen Allele ID: {car_id}</span></li> : null}
                            {(dbSNP_id) ? <li><span>dbSNP ID: {dbSNP_id}</span></li> : null}
                        </ul>
                    </div>
                    {(GRCh37 || GRCh38) ?
                    <div className="bs-callout-content-container">
                        <h4>Genomic</h4>
                        <ul>
                            {(GRCh38) ? <li><span>{GRCh38 + ' (GRCh38)'}</span></li> : null}
                            {(GRCh37) ? <li><span>{GRCh37 + ' (GRCh37)'}</span></li> : null}
                        </ul>
                    </div>
                    : null}
                </div>

                <div className="panel panel-info">
                    <div className="panel-heading"><h3 className="panel-title">Primary Transcript</h3></div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nucleotide Change</th>
                                <th>Protein Change</th>
                                <th>Molecular Consequence</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    {(primary_transcript) ? primary_transcript.nucleotide : '--'}
                                </td>
                                <td>
                                    {(primary_transcript) ? primary_transcript.protein : '--'}
                                </td>
                                <td>
                                    {(primary_transcript) ? primary_transcript.molecular : '--'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="panel panel-info">
                    <div className="panel-heading"><h3 className="panel-title">All Transcripts</h3></div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nucleotide Change</th>
                                <th>Protein Change</th>
                                <th>Molecular Consequence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ensembl_data.map(function(item, i) {
                                return (
                                    <tr key={i}>
                                        <td>{item.hgvsc}</td>
                                        <td>{(item.hgvsp) ? item.hgvsp : '--'}</td>
                                        <td>
                                            {(item.consequence_terms) ? self.handleSOTerms(item.consequence_terms) : '--'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="panel panel-info">
                    <div className="panel-heading"><h3 className="panel-title">LinkOut to external resources</h3></div>
                    <div className="panel-body">
                        <dl className="inline-dl clearfix">
                            <dd>Variation Viewer [<a href={this.variationViewerURL(sequence_location, gene_symbol, 'GRCh38')} target="_blank" title={'Variation Viewer page for ' + GRCh38 + ' in a new window'}>GRCh38</a> - <a href={this.variationViewerURL(sequence_location, gene_symbol, 'GRCh37')} target="_blank" title={'Variation Viewer page for ' + GRCh37 + ' in a new window'}>GRCh37</a>]</dd>
                            <dd>Ensembl Browser [<a href={'http://uswest.ensembl.org/Homo_sapiens/Gene/Summary?g=' + this.getGeneId(ensembl_data)} target="_blank" title={'Ensembl Browser page for ' + this.getGeneId(ensembl_data) + ' in a new window'}>GRCh38</a>]</dd>
                            <dd>UCSC [<a href={this.ucscViewerURL(sequence_location, 'hg38', 'GRCh38')} target="_blank" title={'UCSC Genome Browser for ' + GRCh38 + ' in a new window'}>GRCh38/hg38</a> - <a href={this.ucscViewerURL(sequence_location, 'hg19', 'GRCh37')} target="_blank" title={'UCSC Genome Browser for ' + GRCh37 + ' in a new window'}>GRCh37/hg19</a>]</dd>
                            <dd><a href={'http://www.uniprot.org/uniprot/' + uniprot_id} target="_blank" title={'UniProtKB page for ' + uniprot_id + ' in a new window'}>UniProtKB</a></dd>
                        </dl>
                    </div>
                </div>

            </div>
        );
    }
});
