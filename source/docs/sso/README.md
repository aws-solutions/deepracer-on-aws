# How to Enable Enterprise SSO (SAML) Sign-In

Let users sign in to DeepRacer on AWS with your organization's SAML 2.0 identity provider (IdP), such as Microsoft Entra ID, Okta, or Google Workspace, in addition to email and password.

SSO is **optional and off by default**. When it is off, no SAML resources are created and sign-in is unchanged.

## Before You Start

Make sure you have:

- Permission to register a new SAML application on your IdP
- A reachable **HTTPS metadata URL** for that application (the IdP's federation metadata XML)
- The name of the SAML attribute (claim) that carries each user's **email address**

## How It Works

- Users click **Sign in with SSO** on the sign-in page and are redirected to your IdP through the Amazon Cognito Hosted UI.
- The first time a user signs in, a user and profile are created automatically and the user is added to the default racer group.
- Users must choose a **racer alias** on a "Complete your profile" screen before they can continue. The alias is not taken from the IdP.
- Federated users have no Cognito-managed password, so **Change password** is hidden on the Account page.
- Native email/password sign-in keeps working alongside SSO.
- An SSO user is a separate account from any email/password account. Accounts are **not** linked, even if the email addresses match, so a person who signs in both ways has two profiles with separate models and quotas.

## Step-by-Step Guide

The IdP needs values that only exist after the stack is deployed, so enabling SSO takes two deployments.

### 1. Deploy the stack

Deploy as usual. The stack outputs the two values your IdP needs:

| Output         | Register on the IdP as                                               |
| -------------- | -------------------------------------------------------------------- |
| `SamlAcsUrl`   | Reply URL / Assertion Consumer Service (ACS) URL                     |
| `SamlEntityId` | Identifier / Entity ID (format `urn:amazon:cognito:sp:<userPoolId>`) |

Retrieve them with:

```
aws cloudformation describe-stacks --stack-name <stack-name> \
  --query "Stacks[0].Outputs[?OutputKey=='SamlAcsUrl'||OutputKey=='SamlEntityId']"
```

> The ACS URL contains the Hosted UI domain prefix `<namespace>-dr-auth`, which must be unique within the AWS Region. If enabling SSO fails because the domain is already in use, redeploy with a different `Namespace`.

### 2. Register the application on your IdP

1. Create a new custom SAML application.
2. Set the Identifier/Entity ID and the Reply/ACS URL to the values from step 1.
3. Make sure the SAML assertion includes the user's email address, and note the **attribute Name** (a claim URI such as `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`). This is the attribute Name, not its friendly label.
4. Assign the users or groups who should be allowed to sign in.
5. Copy the application's **metadata URL** (it must start with `https://`).

### 3. Redeploy with the SSO parameters

| Parameter / variable                    | Description                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SamlMetadataUrl` / `SAML_METADATA_URL` | HTTPS URL of the IdP metadata XML. Empty (default) disables SSO.                                                         |
| `SamlEmailClaim` / `SAML_EMAIL_CLAIM`   | Attribute Name that carries the email. Defaults to `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`. |

Use the method that matches how you deploy:

**Makefile** — set these in `build.config` (see `build.config.example`), then run `make deploy`:

```
saml_metadata_url=https://example.com/idp-metadata.xml
saml_email_claim=http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
```

**CDK deploy** — export the variables before running `pnpm nx deploy infra`:

```
export SAML_METADATA_URL='https://example.com/idp-metadata.xml'
export SAML_EMAIL_CLAIM='http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
```

**CloudFormation** — set the `SamlMetadataUrl` and `SamlEmailClaim` stack parameters.

### 4. Sign in

Open the website. A **Sign in with SSO** button appears on the sign-in page. Click it, authenticate with your IdP, and choose a racer alias when prompted.

## Turning SSO Off

Redeploy with `SamlMetadataUrl` empty. The IdP, Hosted UI domain, and OAuth settings are disabled. Users who signed in only through SSO can no longer sign in because they have no password.

## Troubleshooting

| Symptom                                       | Likely cause and fix                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No **Sign in with SSO** button                | `SamlMetadataUrl` was empty when deployed. Check the stack parameters.                                                                                                             |
| IdP error about an unknown application        | The Entity ID registered on the IdP does not exactly match the `SamlEntityId` output.                                                                                              |
| IdP error about a mismatched reply/ACS URL    | The Reply URL on the IdP does not match the `SamlAcsUrl` output.                                                                                                                   |
| Sign-in fails after authenticating at the IdP | `SamlEmailClaim` may not match the attribute Name in the assertion. Compare it with the claims your IdP sends, then redeploy.                                                      |
| "Single sign-on failed. Please try again."    | The first sign-in of a brand-new identity can fail once; the website retries automatically. If it persists, check the Cognito trigger Lambda logs (PreSignUp, PostAuthentication). |

## Limitations

- Only SAML 2.0 is supported (no OIDC).
- One IdP can be configured per deployment.
- The IdP does not assign administrator or other groups; manage groups in the application as before.
- The Hosted UI uses the standard Cognito domain (`*.auth.<region>.amazoncognito.com`), not a custom domain.
