$version: "2"

namespace com.aws.solutions.deepracer

/// Admin-only: set the same usage quotas on up to 200 profiles in a single call. The caller is
/// authorized once; each profile is updated with continue-on-failure, and per-item failures are
/// returned in `errors`, each traceable to its request profileId.
@http(method: "POST", uri: "/profiles/batch-update-quotas")
operation BatchUpdateProfileQuotas {
    input := {
        @required
        profileIds: BatchUpdateProfileQuotasProfileIds

        @required
        maxTotalComputeMinutes: QuotaLimit

        @required
        maxModelCount: QuotaLimit
    }

    output := {
        @required
        updatedProfileIds: ResourceIdentifierList

        @required
        errors: BatchUpdateProfileQuotasErrors
    }

    errors: [
        BadRequestError
        InternalFailureError
        NotAuthorizedError
    ]
}
