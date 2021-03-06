'use strict';

const SCORE_MAPS = {
    AUTOSOMAL_DOMINANT_VARIANT_IS_DE_NOVO: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3],
        MAX_SCORE: 12
    },
    AUTOSOMAL_DOMINANT_PREDICTED_OR_PROVEN_NULL_VARIANT: {
        DEFAULT_SCORE: 1.5,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5, 2],
        MAX_SCORE: 10
    },
    AUTOSOMAL_DOMINANT_OTHER_VARIANT_TYPE_WITH_GENE_IMPACT: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5],
        MAX_SCORE: 7
    },
    X_LINKED_VARIANT_IS_DE_NOVO: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3],
        MAX_SCORE: 12
    },
    X_LINKED_PREDICTED_OR_PROVEN_NULL_VARIANT: {
        DEFAULT_SCORE: 1.5,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5, 2],
        MAX_SCORE: 10
    },
    X_LINKED_OTHER_VARIANT_TYPE_WITH_GENE_IMPACT: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5],
        MAX_SCORE: 7
    },
    AUTOSOMAL_RECESSIVE_TWO_VARIANTS_IN_TRANS_WITH_ONE_DE_NOVO: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5, 2, 2.5, 3],
        MAX_SCORE: 12
    },
    AUTOSOMAL_RECESSIVE_TWO_VARIANTS_WITH_GENE_IMPACT_IN_TRANS: {
        DEFAULT_SCORE: 1,
        SCORE_RANGE: [0, 0.1, 0.25, 0.5, 1, 1.5],
        MAX_SCORE: 12
    },
    FUNCTION_BIOCHEMICAL_FUNCTION: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 2
    },
    FUNCTION_PROTEIN_INTERACTIONS: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 2
    },
    FUNCTION_EXPRESSION: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 2
    },
    FUNCTIONAL_ALTERATION_PATIENT_CELLS: {
        DEFAULT_SCORE: 1,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 2
    },
    FUNCTIONAL_ALTERATION_NON_PATIENT_CELLS: {
        DEFAULT_SCORE: 0.5,
        SCORE_RANGE: [0, 0.5, 1],
        MAX_SCORE: 2
    },
    MODEL_SYSTEMS_NON_HUMAN_MODEL_ORGANISM: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
        MAX_SCORE: 4
    },
    MODEL_SYSTEMS_CELL_CULTURE_MODEL: {
        DEFAULT_SCORE: 1,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 4
    },
    RESCUE_PATIENT_CELLS: {
        DEFAULT_SCORE: 1,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 4
    },
    RESCUE_CELL_CULTURE_MODEL: {
        DEFAULT_SCORE: 1,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2],
        MAX_SCORE: 4
    },
    RESCUE_NON_HUMAN_MODEL_ORGANISM: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
        MAX_SCORE: 4
    },
    RESCUE_HUMAN_MODEL: {
        DEFAULT_SCORE: 2,
        SCORE_RANGE: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
        MAX_SCORE: 4
    }
};

export default SCORE_MAPS;