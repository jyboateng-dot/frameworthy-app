# Google OAuth verification preparation

Status: prepared, not submitted. Google approval is outstanding.

## Console findings

Project: frameworthyco-9c78c
Account inspected: jeremyyboateng@gmail.com
Verification Center reports no sensitive/restricted scopes declared and branding unverified.
Branding uses project-234062883703. Homepage, privacy, terms and developer-contact fields appear blank.
frameworthyco.com is an authorized domain; Search Console ownership has not been verified during this audit.

## Proposed branding fields

- App name: FrameWorthy
- Support email: jeremyyboateng@gmail.com (currently selected in console)
- Developer contact: jeremyyboateng@gmail.com
- Homepage: https://frameworthyco.com/
- Privacy: https://frameworthyco.com/privacy
- Terms: https://frameworthyco.com/terms

The legal routes exist in src/App.jsx. Public page accessibility still needs browser verification.

## Scope justification draft

FrameWorthy lets customers select an image from Google Drive to create a custom framed print. The local implementation requests drive.readonly to display image thumbnails in Google's hosted Picker before selection. After the user chooses an image, FrameWorthy downloads that selected file for the framing workflow. It does not use this permission to edit or delete Drive files.

The narrower drive.file permission supports the import workflow but does not provide pre-selection thumbnails according to Google's Picker guidance. Thumbnail browsing is the reason for the broader permission; do not claim that importing itself requires full-Drive read access. Google must assess whether this justification meets minimum-scope and permitted-use requirements.

## Data handling and outstanding evidence

- Selected artwork and generated production files enter the cloud-hosted image and order workflow. Do not claim all Google data remains on the user's device.
- The existing privacy policy mentions uploaded images, image hosting, and deletion requests, but does not specifically explain Drive read access, the thumbnail use, or Google Limited Use compliance.
- Confirm retention and deletion procedures for original images, derived print files, previews, and copies shared with production partners before making policy commitments.
- Confirm domain ownership in Search Console under a project owner/editor account.
- Verify the deployed app matches the permission and flow being submitted. The thumbnail change has only been verified locally.
- Prepare an unlisted demonstration video using nonprivate sample artwork: app homepage, connect Drive, English consent screen and client ID, thumbnail selection, customization, and resulting data use. No access tokens or private customer data in the recording.
- Restricted data sent to servers can trigger an annual independent security assessment. Do not declare an exemption without establishing eligibility.

## Submission order

1. Complete and verify public branding and privacy disclosures.
2. Save branding fields, run Verify Branding, resolve reported issues, and publish verified branding.
3. Declare the scopes actually requested by the app, including drive.readonly and existing sign-in scopes as applicable.
4. Supply the scope justification, demonstration video, and accurate data-handling details.
5. Submit data-access verification and respond to Google's review and assessment requests.

## Sources

- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/web-picker
