'use strict';
var _ = require('underscore');

// Function for parsing ClinVar data for variant object creation
// Derived from:
// https://github.com/standard-analytics/pubmed-schema-org/blob/master/lib/pubmed.js
module.exports.parseClinvar = parseClinvar;
function parseClinvar(xml){
    var variant = {};
    var doc = new DOMParser().parseFromString(xml, 'text/xml');

    var $ClinVarResult = doc.getElementsByTagName('ClinVarResult-Set')[0];
    if ($ClinVarResult) {
        var $VariationReport = $ClinVarResult.getElementsByTagName('VariationReport')[0];
        if ($VariationReport) {
            // Get the ID (just in case) and Preferred Title
            variant.clinvarVariantId = $VariationReport.getAttribute('VariationID');
            variant.clinvarVariantTitle = $VariationReport.getAttribute('VariationName');
            var $Allele = $VariationReport.getElementsByTagName('Allele')[0];
            if ($Allele) {
                var $HGVSlist_raw = $Allele.getElementsByTagName('HGVSlist')[0];
                if ($HGVSlist_raw) {
                    variant.hgvsNames = {};
                    variant.hgvsNames.others = [];
                    // get the HGVS entries
                    var $HGVSlist = $HGVSlist_raw.getElementsByTagName('HGVS');
                    _.map($HGVSlist, $HGVS => {
                        let temp_hgvs = $HGVS.textContent;
                        let assembly = $HGVS.getAttribute('Assembly');
                        if (assembly) {
                            variant.hgvsNames[assembly] = temp_hgvs;
                        } else {
                            variant.hgvsNames.others.push(temp_hgvs);
                        }
                    });
                }
                variant.dbSNPIds = [];
                var $XRefList = $Allele.getElementsByTagName('XRefList')[0];
                var $XRef = $XRefList.getElementsByTagName('XRef');
                for(var i = 0; i < $XRef.length; i++) {
                    if ($XRef[i].getAttribute('DB') === 'dbSNP') {
                        variant.dbSNPIds.push($XRef[i].getAttribute('ID'));
                    }
                }
            }
        }
    }
    return variant;
}

// Function for parsing CAR data for variant object creation
module.exports.parseCAR = parseCAR;
function parseCAR(json) {
    var data = {};
    // set carId in payload, since we'll always have this from a CAR response
    data.carId = json['@id'].substring(json['@id'].indexOf('CA'));
    if (json.externalRecords) {
        // extract ClinVar data if available
        if (json.externalRecords.ClinVar && json.externalRecords.ClinVar.length > 0) {
            // we only need to look at the first entry since the variantionID and preferred name
            // should be the same for all of them
            data.clinvarVariantId = json.externalRecords.ClinVar[0].variationId;
            data.clinvarVariantTitle = json.externalRecords.ClinVar[0].preferredName;
        }
        // extract dbSNPId data if available
        if (json.externalRecords.dbSNP && json.externalRecords.dbSNP.length > 0) {
            data.dbSNPIds = [];
            json.externalRecords.dbSNP.map(function(dbSNPentry, i) {
                data.dbSNPIds.push(dbSNPentry.rs);
            });
        }
    }
    data.hgvsNames = {};
    if (json.genomicAlleles && json.genomicAlleles.length > 0) {
        json.genomicAlleles.map(function(genomicAllele, i) {
            if (genomicAllele.hgvs && genomicAllele.hgvs.length > 0) {
                // extract the genomicAlleles hgvs terms
                genomicAllele.hgvs.map(function(hgvs_temp, j) {
                    // skip the hgvs term if it starts with 'CM'
                    if (!hgvs_temp.startsWith('CM')) {
                        // FIXME/TODO: cannot easily get reference genome for NCs from CAR.
                        // Base it off the RS###### for now...
                        if (hgvs_temp.startsWith('NC')) {
                            if (genomicAllele.referenceSequence.endsWith('RS000065')) {
                                data.hgvsNames.GRCh38 = hgvs_temp;
                            } else if (genomicAllele.referenceSequence.endsWith('RS000041')) {
                                data.hgvsNames.GRCh37 = hgvs_temp;
                            } else {
                                if (!data.hgvsNames.others) {
                                    data.hgvsNames.others = [];
                                }
                                data.hgvsNames.others.push(hgvs_temp);
                            }
                        } else {
                            if (!data.hgvsNames.others) {
                                data.hgvsNames.others = [];
                            }
                            data.hgvsNames.others.push(hgvs_temp);
                        }
                    }
                });
            }
        });
    }
    // TODO: these should really be cleaned up so it's not using the same code over and over again
    // extract the aminoAcidAlleles hgvs terms
    if (json.aminoAcidAlleles && json.aminoAcidAlleles.length > 0) {
        json.aminoAcidAlleles.map(function(allele, i) {
            if (allele.hgvs && allele.hgvs.length > 0) {
                allele.hgvs.map(function(hgvs_temp, j) {
                    if (!data.hgvsNames.others) {
                        data.hgvsNames.others = [];
                    }
                    data.hgvsNames.others.push(hgvs_temp);
                });
            }
        });
    }
    // extract the transcriptAlleles hgvs terms
    if (json.transcriptAlleles && json.transcriptAlleles.length > 0) {
        json.transcriptAlleles.map(function(allele, i) {
            if (allele.hgvs && allele.hgvs.length > 0) {
                allele.hgvs.map(function(hgvs_temp, j) {
                    if (!data.hgvsNames.others) {
                        data.hgvsNames.others = [];
                    }
                    data.hgvsNames.others.push(hgvs_temp);
                });
            }
        });
    }

    return data;
}
