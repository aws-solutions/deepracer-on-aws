$version: "2"

namespace com.aws.solutions.deepracer

// Either a native generateResourceId() nano ID (https://github.com/ai/nanoid), or the
// Cognito-assigned username a federated (SAML/OIDC) sign-in gets instead —
// "<ProviderName>_<subject>" — mirrors RESOURCE_ID_REGEX_STR in
// libs/database/src/constants/regex.ts, which every resource ID is validated against at the
// database layer; this is the API-layer counterpart and must stay in sync with it.
@pattern("^(?:[A-Za-z0-9-]{15}|[A-Za-z0-9]+_[\\w-]{1,200})$")
string ResourceIdentifier

@range(min: 0, max: 1)
double NormalizedValue

@range(min: 0)
double NonNegativeDouble

@range(min: 0)
integer NonNegativeInteger

@range(min: 1)
integer PositiveInteger

@pattern("^https:\/\/.+$")
string Url

// At least 1 non-whitespace character
@pattern("^.*\\S.*$")
@length(min: 1, max: 64)
string ResourceName

// At least 1 non-whitespace character
@pattern("^.*\\S.*$")
@length(min: 1, max: 255)
string Description

// Model name with alphanumeric characters and hyphens only
@pattern("^[a-zA-Z0-9-]+$")
@length(min: 1, max: 64)
string ModelName

// Model description with alphanumeric characters and hyphens only
@pattern("^[a-zA-Z0-9- ]+$")
@length(min: 1, max: 255)
string ModelDescription

@pattern("^[\\w-]+$")
@length(min: 2, max: 64)
string Alias
