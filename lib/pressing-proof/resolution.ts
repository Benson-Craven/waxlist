import {
  rankPressingCandidates,
  selectNextPressingDiscriminator,
  type PressingCandidate,
  type PressingDiscriminator,
  type PressingEvidence,
  type RankedPressingCandidate,
} from "@/lib/pressing-detective/matching";

export type PressingResolutionKind = "exact" | "shortlist" | "unknown";

export type PressingResolutionContext = {
  totalCandidates: number;
  returnedCandidates: number;
  truncated: boolean;
  failedCandidateIds: number[];
};

export type PressingResolutionCandidate = Omit<
  PressingCandidate,
  "imageUrl" | "notes" | "resourceUrl"
> & {
  matchedEvidence: string[];
  conflictingEvidence: string[];
  unavailableEvidence: string[];
};

export type PressingResolution = {
  kind: PressingResolutionKind;
  reason:
    | "unique_supported_candidate"
    | "multiple_candidates"
    | "comparison_incomplete"
    | "evidence_conflict"
    | "insufficient_evidence";
  resolvedReleaseId: number | null;
  remainingCandidates: PressingResolutionCandidate[];
  rejectedCandidates: PressingResolutionCandidate[];
  nextQuestion: PressingDiscriminator;
  comparisonComplete: boolean;
};

function publicCandidate(
  candidate: RankedPressingCandidate,
): PressingResolutionCandidate {
  const {
    imageUrl: _imageUrl,
    notes: _notes,
    resourceUrl: _resourceUrl,
    score: _score,
    confidenceState: _confidenceState,
    isViable: _isViable,
    matchedSignals,
    conflictingSignals,
    missingSignals,
    exactProofFields: _exactProofFields,
    ...catalogueFields
  } = candidate;

  void _imageUrl;
  void _notes;
  void _resourceUrl;
  void _score;
  void _confidenceState;
  void _isViable;
  void _exactProofFields;

  return {
    ...catalogueFields,
    matchedEvidence: matchedSignals,
    conflictingEvidence: conflictingSignals,
    unavailableEvidence: missingSignals,
  };
}

function hasUniquelySupportingEvidence(candidate: RankedPressingCandidate) {
  return candidate.exactProofFields.length > 0;
}

export function resolvePressingCandidates(input: {
  candidates: PressingCandidate[];
  evidence: PressingEvidence;
  context: PressingResolutionContext;
}): PressingResolution {
  const ranked = rankPressingCandidates(input.candidates, input.evidence);
  const viable = ranked.filter((candidate) => candidate.isViable);
  const rejected = ranked.filter((candidate) => !candidate.isViable);
  const comparisonComplete =
    !input.context.truncated &&
    input.context.failedCandidateIds.length === 0 &&
    input.context.returnedCandidates >= input.context.totalCandidates &&
    input.candidates.every((candidate) => candidate.detailLoaded);
  const remainingCandidates = viable.map(publicCandidate);
  const rejectedCandidates = rejected.map(publicCandidate);

  if (viable.length === 0) {
    return {
      kind: "unknown",
      reason: "evidence_conflict",
      resolvedReleaseId: null,
      remainingCandidates,
      rejectedCandidates,
      nextQuestion: null,
      comparisonComplete,
    };
  }

  if (!comparisonComplete && viable.length === 1) {
    return {
      kind: "unknown",
      reason: "comparison_incomplete",
      resolvedReleaseId: null,
      remainingCandidates,
      rejectedCandidates,
      nextQuestion: null,
      comparisonComplete,
    };
  }

  if (
    comparisonComplete &&
    viable.length === 1 &&
    hasUniquelySupportingEvidence(viable[0])
  ) {
    return {
      kind: "exact",
      reason: "unique_supported_candidate",
      resolvedReleaseId: viable[0].id,
      remainingCandidates,
      rejectedCandidates,
      nextQuestion: null,
      comparisonComplete,
    };
  }

  const nextQuestion = selectNextPressingDiscriminator(viable, input.evidence);

  if (viable.length > 1 && nextQuestion) {
    return {
      kind: "shortlist",
      reason: "multiple_candidates",
      resolvedReleaseId: null,
      remainingCandidates,
      rejectedCandidates,
      nextQuestion,
      comparisonComplete,
    };
  }

  return {
    kind: "unknown",
    reason: comparisonComplete
      ? "insufficient_evidence"
      : "comparison_incomplete",
    resolvedReleaseId: null,
    remainingCandidates,
    rejectedCandidates,
    nextQuestion,
    comparisonComplete,
  };
}
