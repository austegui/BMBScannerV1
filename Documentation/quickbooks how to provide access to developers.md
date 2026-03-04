<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# quickbooks how to provide access to developers

**To provide developers access to QuickBooks Online (QBO), use the Intuit Developer Portal to create an app and authorize it via OAuth 2.0.** This allows secure API access without sharing login credentials. QuickBooks Desktop has separate integrated app permissions, but API focus is on QBO.[^1_1][^1_2]

## Steps for QBO API Access

1. Sign up for a free Intuit Developer account at developer.intuit.com.[^1_2][^1_1]
2. Create a new app, selecting "QuickBooks Online and Payments" as the platform; choose scopes like `com.intuit.quickbooks.accounting` for data access.[^1_3][^1_1][^1_2]
3. Get Client ID and Client Secret from the app's Keys \& OAuth tab (use sandbox for testing).[^1_4][^1_1][^1_3]
4. Implement OAuth 2.0: Redirect users to Intuit's authorization URL; after consent, exchange the code for access/refresh tokens.[^1_1][^1_3]
5. Use tokens in API calls (e.g., Authorization: Bearer {access_token}); refresh as needed (tokens expire in 1 hour, refresh in 100 days).[^1_3]

## Key Considerations

- Users (QuickBooks admins) must authorize the app once via the consent screen, granting scoped access to their company data.[^1_1][^1_3]
- Test in sandbox first with sample data; switch to production keys later.[^1_1]
- Intuit SDKs (Node.js, Python, etc.) simplify OAuth handling.[^1_3]
- For QuickBooks Desktop, approve apps via Edit > Preferences > Integrated Applications (not API-focused).[^1_5]

This integrates well with your automation workflows like n8n or GoHighLevel. Need details for Desktop specifically?
<span style="display:none">[^1_10][^1_11][^1_12][^1_13][^1_14][^1_15][^1_6][^1_7][^1_8][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^1_2]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^1_3]: https://quickbooks.intuit.com/learn-support/en-uk/banking/does-anyone-know-how-i-can-allow-access-for-my-developer-to/00/1489884

[^1_4]: https://www.apideck.com/blog/how-to-get-your-quickbooks-api-key

[^1_5]: https://quickbooks.intuit.com/learn-support/en-us/help-article/security-access/block-applications-accessing-quickbooks-company/L7JM4Ms8o_US_en_US

[^1_6]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq

[^1_7]: https://developer.intuit.com/app/developer/qbo/docs/learn/scopes

[^1_8]: https://www.youtube.com/watch?v=lJunH9-_PEU

[^1_9]: https://www.youtube.com/watch?v=unD6z0-2l60

[^1_10]: https://stackoverflow.com/questions/59577398/how-can-i-authenticate-my-quickbook-intuit-api-access-without-user-interection-a

[^1_11]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/access-permissions/user-roles-access-rights-quickbooks-online/L66POfRrI_CA_en_CA

[^1_12]: https://www.reddit.com/r/msp/comments/ae0mcg/quickbooks_grants_everyone_full_control_of/

[^1_13]: https://quickbooks.intuit.com/learn-support/en-us/account-management/how-do-i-add-a-simple-app-to-provide-production-api-access-for-a/00/1400281

[^1_14]: https://stackoverflow.com/questions/49923856/how-to-securely-store-quickbooks-access-tokens-and-keep-rogue-employees-from-dow

[^1_15]: https://developer.intuit.com/app/developer/qbo/docs/get-started/app-settings


---

# how to provide api acess quickbooks

QuickBooks API access is provided through Intuit's Developer Portal using OAuth 2.0 authorization for QuickBooks Online (QBO). Developers create an app to get credentials, and company admins grant consent for scoped data access.[^2_1][^2_2][^2_3]

## Create Developer App

Sign up at developer.intuit.com and create a QuickBooks app. Select scopes (e.g., Accounting, Payments) and obtain Client ID/Secret from the dashboard.[^2_2][^2_1]

## Authorize Access

Implement OAuth 2.0 flow: Redirect to Intuit's auth endpoint, handle callback, exchange code for access token. Use Bearer token in API requests.[^2_3][^2_1]

## Token Management

Access tokens last 60 minutes; refresh tokens up to 100 days. Store securely and refresh automatically.[^2_3]

## Testing and Production

Use sandbox for dev/testing with sample companies. Switch to production via app settings after approval (basic apps auto-approved).[^2_4][^2_1]

## QuickBooks Desktop Note

Limited API; use Web Connector for integrations or approve apps in Preferences > Integrated Applications.[^2_5]

This fits your API-heavy workflow with n8n/Twilio. Which QuickBooks version are you targeting?

<div align="center">⁂</div>

[^2_1]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^2_2]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^2_3]: https://quickbooks.intuit.com/learn-support/en-uk/banking/does-anyone-know-how-i-can-allow-access-for-my-developer-to/00/1489884

[^2_4]: https://www.apideck.com/blog/how-to-get-your-quickbooks-api-key

[^2_5]: https://quickbooks.intuit.com/learn-support/en-us/help-article/security-access/block-applications-accessing-quickbooks-company/L7JM4Ms8o_US_en_US


---

# they have desktop version

QuickBooks Desktop (QBD) uses the QuickBooks Desktop SDK with QBXML for direct integrations or the Web Connector for remote API-like access. Developers download the SDK from Intuit's portal; no OAuth—requires local install and user approval in QBD.[^3_1][^3_2][^3_3]

## SDK Direct Integration

Download the SDK from developer.intuit.com/app/developer/qbdesktop/docs/get-started. Use QBXML messages or QBFC classes to communicate locally with QBD via session manager.[^3_4][^3_2][^3_1]

## Web Connector for Remote

Best for your API workflows: Install Web Connector (free download matching QBD version, e.g., 2.3.0.x for 2024+).[^3_5][^3_3]

- Generate .qwc config file for your service (defines SOAP endpoints).
- User opens .qwc in Web Connector, grants "Yes, always; allow access even if QB not running".
- Web Connector polls your SOAP service for qbXML requests/responses.[^3_6][^3_7][^3_3]


## Developer Setup

Create free Intuit Developer account. Optionally request dev license key via support ticket for trial/full QBD testing. Implement SOAP server handling Login/authenticate/SendRequestXML/etc.[^3_8][^3_2][^3_1]

## Considerations

Runs on same machine/LAN as QBD; schedule syncs in Web Connector. Supports Pro/Premier/Enterprise (not Mac fully). SDK 64-bit now available.[^3_3][^3_1]

Ideal for your n8n automations via custom SOAP endpoints. Need Web Connector .qwc example code?
<span style="display:none">[^3_10][^3_11][^3_12][^3_13][^3_14][^3_15][^3_16][^3_17][^3_9]</span>

<div align="center">⁂</div>

[^3_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^3_2]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^3_3]: https://quickbooks.intuit.com/learn-support/en-uk/banking/does-anyone-know-how-i-can-allow-access-for-my-developer-to/00/1489884

[^3_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop

[^3_5]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^3_6]: https://www.apination.com/wp-content/uploads/2016/09/Connect_QuickBooks_Desktop.pdf

[^3_7]: https://apix-drive.com/en/blog/other/quickbooks-web-connector-api

[^3_8]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^3_9]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^3_10]: https://developer.intuit.com/app/developer/qbdesktop/docs/develop/exploring-the-quickbooks-desktop-sdk

[^3_11]: https://www.codat.io/blog/integrating-with-quickbooks-desktop/

[^3_12]: https://www.youtube.com/watch?v=613gEk1z7FM

[^3_13]: https://codat.io/blog/integrating-with-quickbooks-desktop/

[^3_14]: https://www.oreateai.com/blog/unlocking-the-power-of-quickbooks-desktop-api-a-guide-for-developers/b566a25c9c1ce4ec6a4fa1ba708ab522

[^3_15]: https://developer.intuit.com/app/developer/qbdesktop/docs/develop

[^3_16]: https://success.procurify.com/en/articles/9002073-how-to-setup-quickbooks-desktop-web-connector

[^3_17]: https://www.apideck.com/blog/exploring-the-quickbooks-online-accounting-api


---

# we need to access my client's quickbooks on desktop and we need api access to create orders etc. how do we do this step by step

To enable API access to your client's QuickBooks Desktop (QBD) for creating orders (e.g., SalesOrderAdd via QBXML), set up the QuickBooks Web Connector (QBWC). This bridges your remote server to their local QBD instance securely—no full REST API exists for Desktop.[^4_1][^4_2][^4_3][^4_4][^4_5]

## Developer Prep (Your Side)

Create a public SOAP web service (e.g., in Node.js/Express, n8n webhook, or AWS Lambda) handling QBWC XML calls: authenticate, sendRequestXML (e.g., SalesOrderAdd QBXML), receiveResponseXML. Host with HTTPS; generate .qwc file XML pointing to it (companyID, app name, endpoint).[^4_6][^4_5][^4_1]

**Sample SalesOrder QBXML** (POST via your service):

```
<?xml version="1.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <SalesOrderAddRq>
      <SalesOrderAdd>
        <CustomerRef><FullName>Customer Name</FullName></CustomerRef>
        <ItemLineAdd>
          <ItemRef><FullName>Item Name</FullName></ItemRef>
          <Quantity>1</Quantity>
        </ItemLineAdd>
      </SalesOrderAdd>
    </SalesOrderAddRq>
  </QBXMLMsgsRq>
</QBXML>
```

Parse response for TxnID.[^4_7][^4_2]

## Client Setup Steps (Their Machine)

1. Download/install latest QBWC matching QBD version (e.g., 2.3+ for 2024/2025) from Intuit site; run as admin.[^4_8][^4_9][^4_5]
2. Open QBD as Admin in single-user mode with company file loaded.[^4_10][^4_6]
3. Provide your generated .qwc file; client double-clicks it (opens QBWC).[^4_11][^4_6]
4. In QBWC: Enter your app password (shared secret); grant "Yes, always; allow access even if QuickBooks is not running".[^4_5][^4_6][^4_10]
5. Set sync interval (e.g., 60 min); run Update Selected or Auto-Run.[^4_11]

## Test and Go Live

- Test with sandbox QBD if possible (dev license via Intuit support).[^4_3]
- Client must keep QBD/QBWC running or allow background access; VPN/remote desktop if hosted remotely.[^4_6]
- Monitor QBWC logs for errors (C:\ProgramData\Intuit\QBWebConnector\logs).[^4_10]

This works for your payment/order automations (Premier/Enterprise needed for Sales Orders). Ready for .qwc/SOAP code samples?
<span style="display:none">[^4_12][^4_13][^4_14][^4_15][^4_16][^4_17][^4_18]</span>

<div align="center">⁂</div>

[^4_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^4_2]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/salesorderadd

[^4_3]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^4_4]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^4_5]: https://quickbooks.intuit.com/learn-support/en-uk/banking/does-anyone-know-how-i-can-allow-access-for-my-developer-to/00/1489884

[^4_6]: https://help.adaptive.build/en/articles/9038301-quickbooks-desktop-setting-up-the-web-connector

[^4_7]: https://developer.intuit.com/app/developer/qbdesktop/docs/develop/tutorials/linking-itemreciept-bill-to-purchase-order-invoice-to-sales-order

[^4_8]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_CA_en_CA

[^4_9]: https://quickbooks.intuit.com/learn-support/en-us/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_US_en_US

[^4_10]: https://success.procurify.com/en/articles/9002073-how-to-setup-quickbooks-desktop-web-connector

[^4_11]: https://kb.bullhorn.com/backoffice/Content/backoffice/Topics/settingUpQuickbooksDesktopWebConnector.htm

[^4_12]: https://quickbooks.intuit.com/learn-support/en-us/help-article/sales-orders/create-sales-order/L6mKnrj8m_US_en_US

[^4_13]: https://www.method.me/resources/how-to-create-an-invoice-in-quickbooks/

[^4_14]: https://www.dancingnumbers.com/set-up-quickbooks-web-connector/

[^4_15]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/invoicing/create-invoice-quickbooks-desktop/L0J64E3xu_CA_en_CA

[^4_16]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/sales-orders/create-sales-order/L6mKnrj8m_CA_en_CA

[^4_17]: https://quickbooks.intuit.com/learn-support/en-us/help-article/accounting-bookkeeping/create-invoice-quickbooks-desktop/L04J5po9E_US_en_US

[^4_18]: https://help.syncware.com/article/200-integrating-quickbooks-web-connector


---

# can we use API or no?

**No, QuickBooks Desktop lacks a native REST API or direct remote API access.** Integrations use the local SDK (QBXML) or Web Connector (SOAP + QBXML) on the client's machine.[^5_1][^5_2][^5_3][^5_4]

## Why No True API?

QBD is a local app; Intuit provides QBXML via SDK for direct/local calls or Web Connector for web-based syncs—no OAuth/REST like Online.[^5_5][^5_6][^5_1]

## Alternatives

- **Web Connector**: Standard for remote order creation (as detailed previously).[^5_7][^5_3]
- **Third-party bridges**: Tools like Skyvia (OData wrapper), Codat, or Apideck proxy QBXML to REST (paid, client setup needed).[^5_5][^5_7]
- **Migrate to Online**: Full REST API available.[^5_8]

Stick with QBWC for your needs. Want third-party recs or QBXML code for orders?
<span style="display:none">[^5_10][^5_11][^5_12][^5_13][^5_14][^5_15][^5_16][^5_9]</span>

<div align="center">⁂</div>

[^5_1]: https://satvasolutions.com/blog/quickbooks-desktop-integration-methods

[^5_2]: https://stackoverflow.com/questions/47936018/how-to-integrate-quickbook-web-connector-with-web-api/47942069

[^5_3]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^5_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^5_5]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^5_6]: https://stackoverflow.com/questions/16458778/connecting-to-quickbooks-using-api

[^5_7]: https://skyvia.com/connect/quickbooksdesktop-odata

[^5_8]: https://developer.intuit.com/app/developer/qbo/docs/develop

[^5_9]: https://unified.to/blog/quickbooks_api_integration_a_step_by_step_guide_for_b2b_saas_teams_2026

[^5_10]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/conductor-rest-api-to-quickbooks-desktop/00/1535022

[^5_11]: https://stackoverflow.com/questions/20552911/quickbooks-desktop-to-send-information-through-rest-api

[^5_12]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/quickbooks-desktop-rest-api/00/977218

[^5_13]: https://apix-drive.com/en/blog/other/quickbooks-web-connector-api

[^5_14]: https://zapier.com/blog/quickbooks-alternatives/

[^5_15]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop

[^5_16]: https://www.method.me/blog/quickbooks-desktop-alternatives/


---

# okay so you recommend using web connector? if so how do I provide the access to them? I am in intuit developer now

Yes, Web Connector is the recommended and standard way to provide remote API-like access (QBXML) to QuickBooks Desktop for creating orders. Since you're in the Intuit Developer portal, download the SDK/docs and generate a .qwc file for your client.[^6_1][^6_2][^6_3][^6_4]

## Generate .qwc File

1. In Developer portal, go to qbdesktop docs > Web Connector > Programmer's Guide (or SDK install).[^6_3]
2. Create XML .qwc file with your details:
```
<?xml version="1.0"?>
<QBWCXML>
  <AppName>Your App Name</AppName>
  <AppURL>https://yourserver.com/qbwc/service</AppURL>
  <AppDescription>Order Creation Service</AppDescription>
  <AppSupport>https://yourhelp.com</AppSupport>
  <User>CompanyID</User>
  <CertID>YourCert</CertID> <!-- Optional -->
  <FileFormatVer>2.1</FileFormatVer>
  <Scheduler>
    <RunEveryNMinutes>60</RunEveryNMinutes>
  </Scheduler>
</QBWCXML>
```

Validate with QBWC XML schema; host your SOAP service at AppURL.[^6_2][^6_3]

## Provide Access to Client

1. **Email them the .qwc file** (and QBWC installer if needed: latest 2.3.0.215+ from developer.intuit.com).[^6_4][^6_3]
2. Client instructions:
    - Install QBWC (run as admin; match QBD version, e.g., 2024+).[^6_4]
    - Open QBD as Admin, company file loaded (single-user).
    - Double-click .qwc (opens QBWC).
    - Enter app password (your shared secret).
    - Grant "Yes, always" access (even if QB not running).[^6_4]
3. Client runs "Update Selected"; test with your service.[^6_4]

## Next

Build/test SOAP endpoint (Node.js examples in SDK). Client keeps QBWC auto-running. This enables order creation via QBXML.[^6_2]

Need a full .qwc template or Node.js SOAP starter code?

<div align="center">⁂</div>

[^6_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^6_2]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^6_3]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^6_4]: https://quickbooks.intuit.com/learn-support/en-uk/banking/does-anyone-know-how-i-can-allow-access-for-my-developer-to/00/1489884


---

# I thought we needed to create an app?

No, you don't need to create an "app" in the Intuit Developer portal like for QuickBooks Online (OAuth). For Desktop Web Connector, the Developer account gives you SDK/docs/downloads—register your service via the .qwc file directly with the client.[^7_1][^7_2][^7_3][^7_4]

## App vs. Desktop Difference

- **QBO**: Create app for Client ID/Secret/OAuth scopes.[^7_5]
- **Desktop**: No app approval; just build SOAP service, generate .qwc (your "app config"), client installs/approves locally.[^7_2][^7_4][^7_1]


## Your Next Action

Download QB Desktop SDK from portal (for QBXML schemas/samples). Build/test your SOAP endpoint, generate .qwc as shown previously, send to client.[^7_3][^7_4]

This skips Online-style bureaucracy. Need SDK download link or SOAP code example?
<span style="display:none">[^7_10][^7_11][^7_12][^7_13][^7_14][^7_15][^7_16][^7_6][^7_7][^7_8][^7_9]</span>

<div align="center">⁂</div>

[^7_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^7_2]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^7_3]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^7_4]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^7_5]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^7_6]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_CA_en_CA

[^7_7]: https://developer.intuit.com/app/developer/qbdesktop/docs/develop/sample-applications-and-code

[^7_8]: https://docs.mydbsync.com/cloud-workflow/connectors/quickbooks-online/create-a-private-quickbooks-online-qbo-app-on-intuit-developer-portal

[^7_9]: https://quickbooks.intuit.com/learn-support/en-us/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_US_en_US

[^7_10]: https://support.myworks.software/en_US/1500000440942-Web-Connector/360048701113-Using-the-Intuit-QuickBooks-Web-Connector

[^7_11]: https://stackoverflow.com/questions/22329226/desktop-application-use-ipp-qbo-api-3-0

[^7_12]: https://kb.bullhorn.com/backoffice/Content/backoffice/Topics/settingUpQuickbooksDesktopWebConnector.htm

[^7_13]: https://developer.intuit.com/app/developer/qbdesktop/docs/go-live/your-apps-for-quickbooks-desktop-developer-account

[^7_14]: https://knowledge.kantata.com/hc/en-us/articles/360002716894-Using-Intuit-s-Web-Connector-to-Integrate-QuickBooks-Desktop-with-Kantata-OX

[^7_15]: https://www.youtube.com/watch?v=QVlC2TK83pQ

[^7_16]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/create-an-intuit-developer-account


---

# I dont see qbdesktop docs

**QBDesktop docs are under the QuickBooks Desktop section in the Intuit Developer portal sidebar or search.** Log in at developer.intuit.com, search "QuickBooks Desktop SDK" or navigate Products > QuickBooks Desktop.[^8_1][^8_2]

## Find and Access

1. Login > Dashboard > Search bar: "qbdesktop" or "Desktop SDK".[^8_1]
2. Direct links:
    - Get Started: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started[^8_2]
    - Download SDK 17.0 (240MB installer, 64-bit): https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk[^8_1]
3. Install SDK for QBXML docs, samples, QBWC Programmer's Guide (QBSDK17.0\doc\pdf\QBWC_ProGuide.pdf).[^8_3][^8_1]

## Why Hidden?

Portal emphasizes Online apps; Desktop SDK is legacy but fully supported (2023+ versions). No app creation needed—just download.[^8_4][^8_5]

Download SDK now for .qwc validation and QBXML for orders. Need help with search/navigation screenshot?
<span style="display:none">[^8_10][^8_11][^8_12][^8_13][^8_14][^8_15][^8_16][^8_6][^8_7][^8_8][^8_9]</span>

<div align="center">⁂</div>

[^8_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk

[^8_2]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^8_3]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^8_4]: https://stackoverflow.com/questions/19904236/quickbooks-sdk-13-0-qbsdk130-exe

[^8_5]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^8_6]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^8_7]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/desktop-sdk-features

[^8_8]: https://www.letsyncsolution.com/docs/quickbooks-desktop-api-reference/

[^8_9]: https://www.endpointdev.com/blog/2020/12/demonstrating-quickbooks-desktop-sdk/

[^8_10]: https://developer.intuit.com/app/developer/qbo/docs/develop

[^8_11]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/before-you-start

[^8_12]: https://www.youtube.com/watch?v=yenpA-6Q3gs

[^8_13]: https://loc.edu/wp-content/uploads/event-manager-uploads/event_banner/2026/01/CheckDesktopSupportStatus-1.pdf

[^8_14]: https://quickbooks.intuit.com/learn-support/en-ca/other-questions/to-develop-an-interface-using-sdk-for-quickbooks-desktop/00/1372516

[^8_15]: https://support.flexquarters.com/esupport/index.php?%2FKnowledgebase%2FArticle%2FView%2F3038

[^8_16]: https://www.youtube.com/watch?v=6Sl6oyY-sZk


---

# once we download then what?

After downloading the QuickBooks Desktop SDK 17.0 installer (~240MB) from the developer portal, install it on your dev machine to access QBXML references, samples, and QBWC Programmer's Guide. This equips you to build the SOAP service and .qwc for your client.[^9_1][^9_2]

## Post-Install Steps

1. **Run installer** (requires login; supports 64-bit); extracts to C:\QBSDK17.0 (docs in /doc/, samples in /examples/, QBWC ProGuide PDF).[^9_3][^9_1]
2. **Study QBWC Programmer's Guide** (QBSDK17.0\doc\pdf\QBWC_ProGuide.pdf): Details WSDL methods (authenticate, sendRequestXML, etc.), .qwc format.[^9_3]
3. **Build/test SOAP service** locally (e.g., Node.js with soap lib; use SDK samples for QBXML like SalesOrderAdd).[^9_3]
4. **Generate .qwc** using guide template; validate with QBWC (download separately: 2.3.0.215+ for QBD 2024+).[^9_4]
5. **Deploy service** to HTTPS server; send .qwc + QBWC installer + instructions to client.[^9_4]

## Client Receives

They install QBWC, open .qwc, approve—sync starts.[^9_4]

Use SDK samples for order creation code. Test with trial QBD if needed (request dev license). Ready for code examples?

<div align="center">⁂</div>

[^9_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk

[^9_2]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^9_3]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^9_4]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq


---

# what is the .qwc?

The .qwc file is a simple XML configuration file that registers your web service with QuickBooks Web Connector on the client's machine.[^10_1][^10_4][^10_7]

## Purpose

It tells QBWC your app name, SOAP endpoint URL (https://yourserver.com/qbwc), sync schedule (e.g., every 60 min), support URL, and optional certificate—client double-clicks it to add your service automatically.[^10_6][^10_7]

## Structure Example

```
<?xml version="1.0"?>
<QBWCXML>
  <AppName>OrderSync Pro</AppName>
  <AppURL>https://yourdomain.com/qbwc/soap</AppURL>
  <AppDescription>Creates orders/invoices</AppDescription>
  <AppSupport>https://yourhelp.com</AppSupport>
  <User>ClientCompanyID</User>
  <CertID>YourOptionalCert</CertID>
  <FileFormatVer>2.1.0.0</FileFormatVer>
  <Scheduler>
    <RunEveryNMinutes>60</RunEveryNMinutes>
  </Scheduler>
</QBWCXML>
```

Save as `yourapp.qwc`; client opens in QBWC to connect.[^10_4][^10_10]

## Your Workflow

1. Create this XML after building SOAP service.
2. Email .qwc to client—they install QBWC, double-click, enter password, approve.
3. QBWC calls your service for QBXML syncs (orders).[^10_7]

Templates in SDK's QBWC_ProGuide.pdf post-install. Need full customizable template?
<span style="display:none">[^10_2][^10_3][^10_5][^10_8][^10_9]</span>

<div align="center">⁂</div>

[^10_1]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/banking/file-types-extensions-used-quickbooks-desktop/L3vuO2X4c_CA_en_CA

[^10_2]: https://webkul.uvdesk.com/es/blog/what-is-the-need-of-qwc-file-in-magento2-quickbooks-desktop-connector

[^10_3]: https://tipalti.com/blog/quickbooks-file-formats/

[^10_4]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/qb-desktop-clarification/00/281707

[^10_5]: https://help.housecallpro.com/en/articles/5452812-quickbooks-desktop-downloading-a-new-qwc-file

[^10_6]: https://planergy.com/blog/quickbooks-file-types/

[^10_7]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^10_8]: https://hackmd.io/@nikjones/import-qbxml-file-into-quickbooks-desktop

[^10_9]: https://help.marginedge.com/hc/en-us/articles/10403979967763-Reconnecting-to-QuickBooks-Desktop

[^10_10]: https://stackoverflow.com/questions/19420766/how-to-create-a-qwc-file-for-quickbooks-web-connector


---

# once that is registered how do we build the app/endpoints to create work orders etc

Once .qwc is registered (client approves), QBWC polls your HTTPS SOAP endpoint periodically with XML requests. Build a Node.js (fits your JS/API stack) server implementing QBWC WSDL methods to handle auth and QBXML for work orders (modeled as Sales Orders in QBD Premier+).[^11_1][^11_2][^11_3][^11_4]

## Build SOAP Endpoint

Use `soap` npm package for WSDL/server. Expose /qbwc (WSDL) and service at AppURL from .qwc.[^11_2][^11_3]

**Node.js Starter (n8n-compatible webhook or Express):**

```javascript
const express = require('express');
const soap = require('soap');
const http = require('http');
const app = express();
const server = http.createServer(app);
const port = 3000;

// Your QBXML handler logic here
const qbXMLHandler = {
  fetchRequests: (callback) => {
    // Return array of QBXML strings, e.g., for work order:
    const xml = `<?xml version="1.0"?><!DOCTYPE QBXML...><QBXMLMsgsRq><SalesOrderAddRq><SalesOrderAdd><CustomerRef><FullName>Client Job</FullName></CustomerRef><ItemLineAdd><ItemRef><FullName>Labor</FullName></ItemRef><Quantity>8</Quantity></ItemLineAdd></SalesOrderAdd></SalesOrderAddRq></QBXMLMsgsRq>`;
    callback(null, [xml]);
  },
  handleResponse: (response) => { console.log('Created order:', response); /* Save TxnID */ },
  didReceiveError: (error) => { console.error(error); }
};

const service = {
  QBWebConnectorSvcSoap: {
    authenticate: (args, cb) => { cb(null, { string1: 'yourpassword', string2: 'ignored' }); }, // Match client pw
    sendRequestXML: (args, cb) => { /* Parse args, queue from handler */ cb(null, { strHCPResponse: 'OK' }); },
    receiveResponseXML: (args, cb) => { qbXMLHandler.handleResponse(args.response); cb(null, { strStatus: 'OK' }); },
    getLastError: (args, cb) => { cb(null, { strError: '' }); },
    connectionError: (args, cb) => { cb(null, { strError: '' }); },
    version: (args, cb) => { cb(null, { strVersion: '1.2.0.0' }); }
  }
};

soap.listen(server, '/qbwc', service, xml); // Generate WSDL
server.listen(port, () => console.log(`SOAP at http://localhost:${port}/qbwc?wsdl`));
```

Run with `npm i soap express`.[^11_3][^11_2]

## Handle Work Orders

- Enable Sales Orders in QBD (Edit > Preferences > Sales \& Customers > Company Preferences).[^11_5]
- Use `SalesOrderAdd` QBXML (SDK docs post-install): CustomerRef, ItemRef, Qty, etc.; get TxnID response.[^11_1]
- For "work orders," customize Sales Order template or use custom fields.[^11_6]

Deploy to HTTPS (Heroku/Vercel with ngrok for test). Client syncs trigger fetchRequests/handleResponse. Perfect for n8n orchestration.

Need full repo example or QBXML for specific fields?
<span style="display:none">[^11_10][^11_11][^11_12][^11_13][^11_14][^11_15][^11_16][^11_7][^11_8][^11_9]</span>

<div align="center">⁂</div>

[^11_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/salesorderadd

[^11_2]: https://github.com/RappidDevelopment/quickbooks-js

[^11_3]: https://www.npmjs.com/package/soap

[^11_4]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^11_5]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/sales-orders/create-sales-order/L6mKnrj8m_CA_en_CA

[^11_6]: https://www.method.me/blog/quickbooks-work-order/

[^11_7]: https://quickbooks.intuit.com/learn-support/en-ca/sales-customers/how-do-i-create-a-work-order/00/836731

[^11_8]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/sales-orders/create-manage-sales-orders/L1K2AQ1Lx_CA_en_CA

[^11_9]: https://www.lexul.com/create-a-work-order-in-quickbooks-online/

[^11_10]: https://gist.github.com/ruckus/e62d4200deef7e376294

[^11_11]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/invoicing/create-invoices-quickbooks-online/L7gSzvCld_CA_en_CA

[^11_12]: https://www.youtube.com/watch?v=UsDIzItgtx0

[^11_13]: https://www.smartservice.com/blog/quickbooks-work-orders

[^11_14]: https://www.youtube.com/watch?v=N7q2MlMG6xw

[^11_15]: https://quickbooks.intuit.com/learn-support/en-ca/sales-customers/how-do-i-create-a-work-order-in-quickbooks-online/00/261064

[^11_16]: https://stackoverflow.com/questions/32255742/quickbookdesktop-api-integration-using-quickbook-connector-and-nodejs


---

# this is connected to a voice agent that will be taking work orders and checking inventory over the phone. we will be possible to hit these endpoints correct?

Yes, your voice agent (Retell/OpenAI) can hit your custom REST/internal endpoints to trigger QBXML actions during QBWC syncs. The SOAP service acts as middleware: voice → your API → queue QBXML in fetchRequests (create/check inventory) → QBWC syncs with client's QBD → response back via receiveResponseXML.[^12_1][^12_2][^12_3]

## Voice Agent Integration

1. **Voice captures order**: "2 hours labor on roof, check shingles stock" → POST to your /api/order {customer: "ABC Roofing", items: [{name: "Labor", qty: 8}, {name: "Shingles", qty: 50}]}.
2. **Your app queues**: Store in DB/Redis keyed by companyID (from .qwc User).
3. **QBWC calls fetchRequestXML**: SOAP returns pending QBXML array:

```
- Create: `<SalesOrderAddRq>...</SalesOrderAddRq>` for work order.[^12_2]
```

```
- Check: `<ItemInventoryQueryRq><NameFilter><Name>Shingles</Name></NameFilter></ItemInventoryQueryRq>` returns QtyOnHand.[^12_1]
```

4. **Process response**: receiveResponseXML parses TxnID/QOH → update voice via webhook/push.
5. **n8n/Retell flow**: Webhook from voice → queue → poll responses post-sync.[^12_3]

## Benefits for Your Setup

- Real-time-ish (sync interval, e.g., 5-60 min).
- Inventory: ItemInventoryQuery for QtyOnHand/ReorderPoint.[^12_1]
- Works with Premier+ for advanced items/sites.

Scale with multiple clients via companyID. Test sync with ngrok. Need QBXML for inventory check or full Node.js repo?
<span style="display:none">[^12_10][^12_11][^12_12][^12_13][^12_14][^12_15][^12_16][^12_17][^12_4][^12_5][^12_6][^12_7][^12_8][^12_9]</span>

<div align="center">⁂</div>

[^12_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/iteminventoryquery

[^12_2]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/salesorderadd

[^12_3]: https://github.com/RappidDevelopment/quickbooks-js

[^12_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/checkquery

[^12_5]: https://developer.intuit.com/app/developer/qbdesktop/docs/develop/exploring-the-quickbooks-desktop-sdk/query-requests-and-responses

[^12_6]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/itemquery

[^12_7]: https://stackoverflow.com/questions/44969001/quickbooks-qbxml-how-to-exclude-fields

[^12_8]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbpos/iteminventoryquery

[^12_9]: https://stackoverflow.com/questions/19428337/how-do-i-retrieve-quickbooks-inventory-quantity-by-site-using-the-sdk-advanced

[^12_10]: https://github.com/IntuitDeveloper/QBXML_SDK_Samples/blob/master/readme.html

[^12_11]: https://www.youtube.com/watch?v=AVUJD0pU_dI

[^12_12]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/transactionquery

[^12_13]: https://github.com/qbwc/qbxml

[^12_14]: https://sanmolsoftware.com/services/qbRequests/Example_qbXML_Requests

[^12_15]: https://www.youtube.com/watch?v=VPaj8Wavdpk

[^12_16]: https://cloud.tencent.com/developer/ask/sof/114624759

[^12_17]: https://github.com/IntuitDeveloper/QBXML_SDK_Samples/blob/master/xmlfiles/CheckQueryRq.xml


---

# okay so this isnt real time response?

**No, QBWC is not real-time—it's poll-based (client-configured interval like 5-60 minutes), so voice agent gets responses on next sync.** For phone calls (30-60s), queue actions and respond "Order queued, inventory check coming after sync" or use polling/caching for recent data.[^13_1][^13_2][^13_3]

## Why Not Real-Time?

QBD is local Windows app; QBWC bridges web-to-desktop via scheduled SOAP calls—no webhooks/push. SDK direct integration requires your code on *client's machine* (not remote).[^13_4][^13_2]

## Make It Voice-Friendly

- **Queue + Notify**: Voice hits your REST API → queue QBXML → post-sync webhook/pushover to agent "50 shingles available, order \#123 created".
- **Cache Inventory**: Poll ItemInventoryQuery on sync → store in your DB → voice queries instantly (stale by sync interval).
- **Minimize Latency**: Set QBWC to 1-5 min; voice confirms "Sync in 2 min".


## Real-Time Alternatives

| Option | Real-Time? | Notes |
| :-- | :-- | :-- |
| QuickBooks Online Migration | Yes (REST API + webhooks) | Best for voice AI; instant inventory/orders [^13_5] |
| Third-party (Codat/Apideck/Skyvia) | Semi (poll wrappers) | Proxy QBXML to REST; still sync-limited [^13_2][^13_6] |
| Client-side SDK app | Yes | You ship EXE/service to client PC—complex for services [^13_2] |
| Inventory add-ons (SOS/Rapid) | Near-real-time | Sync layers; paid [^13_7][^13_8] |

Recommend QBO switch for Retell flows. Viable with QBWC for non-urgent? Or migration help?
<span style="display:none">[^13_10][^13_11][^13_12][^13_13][^13_14][^13_15][^13_16][^13_17][^13_9]</span>

<div align="center">⁂</div>

[^13_1]: https://stackoverflow.com/questions/55686434/alternative-to-quickbooks-webconnector

[^13_2]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^13_3]: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

[^13_4]: https://www.reddit.com/r/CRM/comments/1r2zqgc/crm_that_integrates_with_quickbooks_desktop/

[^13_5]: https://nocodeapi.com/tutorials/quickbooks-online-api-integration-a-no-code-approach/

[^13_6]: https://skyvia.com/connect/quickbooksdesktop-odata

[^13_7]: https://rapidinventory.com

[^13_8]: https://sosinventory.com

[^13_9]: https://quickbooks.intuit.com/ca/resources/apps/quickbooks-integrations/

[^13_10]: https://quickbooks.intuit.com/accounting/inventory/

[^13_11]: https://zapier.com/blog/quickbooks-alternatives/

[^13_12]: https://www.youtube.com/watch?v=AVUJD0pU_dI

[^13_13]: https://quickbooks.intuit.com/online/integrations/

[^13_14]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/inventory-management/set-track-inventory-quickbooks-online/L22FZLBGN_CA_en_CA

[^13_15]: https://www.cdata.com/blog/cdata-replacement-for-deprecated-quickbooks-powerbi-connector

[^13_16]: https://quickbooks.intuit.com/desktop/enterprise/advanced-inventory/

[^13_17]: https://quickbooks.intuit.com/learn-support/en-us/help-article/inventory-account/set-inventory-quickbooks-desktop/L0WP0Bt6u_US_en_US


---

# okay so how do I set this up?

**Set up QBWC for your voice agent's work orders/inventory by building the SOAP service first, generating .qwc, and guiding the client.** It's poll-based (not real-time), but queue actions for post-sync voice updates.[^14_1][^14_2][^14_3]

## Complete Setup Steps

### 1. Your Dev Setup (Today)

- Download/install QB Desktop SDK 17.0 from developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk.[^14_4]
- Review QBWC ProGuide.pdf (SDK\doc\pdf) for WSDL/QBXML.[^14_5]
- Build/deploy Node.js SOAP server (previous code; /qbwc?wsdl); test locally with ngrok.[^14_6][^14_7]
- Queue logic: Voice webhook → DB → fetchRequestXML returns QBXML (SalesOrderAdd, ItemInventoryQuery).[^14_8][^14_9]


### 2. Generate .qwc

Use SDK template:

```
<?xml version="1.0" encoding="UTF-8"?>
<QBWCXML>
  <AppName>VoiceOrderSync</AppName>
  <AppURL>https://yourdomain.com/qbwc</AppURL>
  <AppDescription>Voice AI work orders/inventory</AppDescription>
  <AppSupport>https://yourhelp.com</AppSupport>
  <User>clientcompany123</User> <!-- Unique per client -->
  <FileFormatVer>8.0</FileFormatVer>
  <Scheduler><RunEveryNMinutes>5</RunEveryNMinutes></Scheduler>
</QBWCXML>
```

Save/send to client.[^14_3][^14_10]

### 3. Client Instructions (Copy-Paste Email)

1. Download/install latest QBWC (2.3.0.215+) from developer.intuit.com: Extract ZIP, run QBWebConnectorInstaller.exe as Admin.[^14_11][^14_1]
2. Open QBD as Admin in single-user mode, load company file.
3. Double-click yourapp.qwc (opens QBWC).
4. Enter password (your shared secret, e.g., "bizqbwc").
5. Select "Yes, always; allow access even if QuickBooks is not running".
6. Check box, set interval to 5 min, click Update Selected—test sync![^14_12][^14_13][^14_1]
7. Pin QBWC to taskbar; enable Auto-Run.[^14_14]

### 4. Go Live + Voice

- Voice → your REST API → queue.
- Sync: QBWC → your SOAP → QBD → response → notify voice.
- Monitor: QBWC logs (C:\ProgramData\Intuit\QBWebConnector\logs\QWCLog.txt).[^14_2]

Full code repos: github.com/RappidDevelopment/quickbooks-js or SDK samples. Client QBD Premier+?[^14_6]
<span style="display:none">[^14_15][^14_16][^14_17][^14_18][^14_19][^14_20][^14_21][^14_22]</span>

<div align="center">⁂</div>

[^14_1]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_CA_en_CA

[^14_2]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^14_3]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^14_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk

[^14_5]: https://developer.intuit.com/app/developer/qbo/docs/get-started/start-developing-your-app

[^14_6]: https://github.com/RappidDevelopment/quickbooks-js

[^14_7]: https://www.npmjs.com/package/soap

[^14_8]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/iteminventoryquery

[^14_9]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/salesorderadd

[^14_10]: https://stackoverflow.com/questions/19420766/how-to-create-a-qwc-file-for-quickbooks-web-connector

[^14_11]: https://quickbooks.intuit.com/learn-support/en-us/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_US_en_US

[^14_12]: https://docs.syncromsp.com/imported/quickbooks-desktop-setup-and-help

[^14_13]: https://help.syncware.com/article/200-integrating-quickbooks-web-connector

[^14_14]: https://www.youtube.com/watch?v=8TRA3o6ZeVU

[^14_15]: https://www.saasant.com/blog/setup-quickbooks-desktop/

[^14_16]: https://hackmd.io/@mainmarta/how-to-install-quickbooks-web-connector-complete-Install-setup-guide

[^14_17]: https://success.procurify.com/en/articles/9002073-how-to-setup-quickbooks-desktop-web-connector

[^14_18]: https://support.myworks.software/en_US/1500000440942-Web-Connector/360048701113-Using-the-Intuit-QuickBooks-Web-Connector

[^14_19]: https://www.thesagenext.com/blog/set-up-of-quickbooks-web-connector

[^14_20]: https://www.youtube.com/watch?v=x7B_fVmV4K8

[^14_21]: https://kb.bullhorn.com/backoffice/Content/backoffice/Topics/settingUpQuickbooksDesktopWebConnector.htm

[^14_22]: https://www.youtube.com/watch?v=4-qB7Cz9Clc


---

# okay so we could pull inventory live though correct?

**No, you cannot pull inventory "live" (instantly on-demand) with QBWC—queries happen only during scheduled syncs (e.g., every 5 min).** Voice agent would get cached/previous sync data or "pending check" response.[^15_1][^15_2][^15_3]

## How Inventory Pull Works

- QBWC sync → your fetchRequestXML → send `<ItemInventoryQueryRq NameListID="Shingles">` → QBD responds QtyOnHand → receiveResponseXML → cache in your DB.
- Voice queries your REST API for latest cached value (freshness = last sync).[^15_2][^15_4]
- Min sync 1 min, but client must run QBWC/QBD; delays if file busy.[^15_3]


## Live Options Table

| Method | Live Pull? | Voice Fit |
| :-- | :-- | :-- |
| QBWC (Recommended) | No (sync interval) | Queue + cache; good for orders [^15_1] |
| Client-side SDK | Yes | Ship app to client PC—high maintenance [^15_5] |
| QBO Migration | Yes (API + webhooks) | Instant inventory/orders; ideal for Retell [^15_6] |
| Add-ons (Rapid/SOS) | Near (their sync) | Extra cost, still poll-based [^15_7] |

Cache suffices for phone ("We have 50 last sync"); confirm post-call. Proceed with QBWC or explore QBO?
<span style="display:none">[^15_10][^15_11][^15_12][^15_13][^15_14][^15_15][^15_16][^15_17][^15_8][^15_9]</span>

<div align="center">⁂</div>

[^15_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^15_2]: https://stackoverflow.com/questions/56222391/get-inventory-from-quickbooks-and-update-to-ecommerce-platform

[^15_3]: https://www.reddit.com/r/QuickBooks/comments/1lj2auh/quickbooks_web_connector_qbwc_autorun_issues_with/

[^15_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/iteminventoryquery

[^15_5]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^15_6]: https://quickbooks.intuit.com/accounting/inventory/

[^15_7]: https://rapidinventory.com

[^15_8]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_CA_en_CA

[^15_9]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/web-connector-and-quickbooks-online/00/1120287

[^15_10]: https://stackoverflow.com/questions/34345320/quickbooks-desktop-web-connector-can-i-make-an-inventory-adjustment-based-on-ite

[^15_11]: https://quickbooks.intuit.com/learn-support/en-us/help-article/report-management/use-reports-see-sales-inventory-status/L7ocoLmqP_US_en_US

[^15_12]: https://blog.accountinghelpline.com/quickbooks-desktop-pro/quickbooks-web-connector/

[^15_13]: https://docs.qbcore.org/qbcore-documentation/qbcore-resources/qb-inventory

[^15_14]: https://quickbooks.intuit.com/ca/inventory-tracking/

[^15_15]: https://quickbooks.intuit.com/learn-support/en-us/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_US_en_US

[^15_16]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/inventory-management/set-track-inventory-quickbooks-online/L22FZLBGN_CA_en_CA

[^15_17]: https://www.youtube.com/watch?v=cGiSZ2S4Rzo


---

# how do we do this step: Build/deploy Node.js SOAP server (previous code; /qbwc?wsdl); test locally with ngrok.

**Build the Node.js SOAP server for QBWC using the `soap` package, expose /qbwc?wsdl, and test with ngrok for HTTPS.** This handles QBXML queuing for your voice agent's orders/inventory during client syncs.[^16_1][^16_2]

## Step-by-Step Build

1. **Init Project**:

```
mkdir qbwc-server && cd qbwc-server
npm init -y
npm i soap express cors body-parser lowdb  # lowdb for queue DB
```

2. **Full server.js** (expand previous):

```javascript
const express = require('express');
const soap = require('soap');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ queues: {}, responses: {} }).write();

const app = express();
app.use(cors());
app.use(express.json());  // For voice REST API

// Voice REST endpoint example
app.post('/api/order', (req, res) => {
  const { companyId, customer, items } = req.body;
  db.set(`queues.${companyId}`, { customer, items }).write();
  res.json({ status: 'Queued for next sync' });
});

// Get cached inventory
app.get('/api/inventory/:companyId/:item', (req, res) => {
  const data = db.get(`responses.${req.params.companyId}`).value() || {};
  res.json(data);
});

const server = require('http').createServer(app);

const qbService = {
  QBWebConnectorSvcSoap: {
    authenticate: (args, cb) => cb(null, { string1: args.strUserName, string2: '' }),  // Validate pw
    sendRequestXML: (args, cb) => {
      const companyId = args.strHCPResponse;
      const queue = db.get(`queues.${companyId}`).value();
      if (!queue) return cb(null, { strHCPResponse: '' });
      // Generate QBXML for order/inventory
      const xml = queue.items.map(i => `<ItemInventoryQueryRq><NameFilter><Name>${i.name}</Name></NameFilter></ItemInventoryQueryRq>`).join('') +
                  `<SalesOrderAddRq><SalesOrderAdd><CustomerRef><FullName>${queue.customer}</FullName></CustomerRef></SalesOrderAdd></SalesOrderAddRq>`;
      cb(null, { strHCPResponse: xml });
    },
    receiveResponseXML: (args, cb) => {
      // Parse QBXML response, extract QtyOnHand/TxnID
      db.set(`responses.${args.strHCPResponse}`, { inventory: 'parsed data' }).write();  // Notify voice?
      cb(null, { strStatus: 'OK' });
    },
    getLastError: (args, cb) => cb(null, { strError: '' }),
    connectionError: (args, cb) => cb(null, { strError: '' }),
    version: (args, cb) => cb(null, { strVersion: '1.2.0.0' })
  }
};

soap.listen(server, '/qbwc', qbService, `
<definitions name="QBWC" targetNamespace="yourns" xmlns:yourns="yourns" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="yourns">
  <!-- Full WSDL defs from SDK QBWC_ProGuide -->
  <portType name="QBWebConnectorSvcSoapPortType">...</portType>  <!-- Copy from SDK -->
</definitions>`);
server.listen(3000, () => console.log('Server at http://localhost:3000/qbwc?wsdl'));
```

3. **Run Locally**: `node server.js`. Visit http://localhost:3000/qbwc?wsdl.
4. **Test with ngrok** (HTTPS required):

```
npm i -g ngrok
ngrok http 3000
```

Copy https://abc123.ngrok.io → use in .qwc AppURL. Test voice POST /api/order.[^16_1]

## Deploy

- Vercel/Netlify (serverless limits; use Railway/Render for Node).
- Add auth, parse QBXML fully (xml2js), webhook for voice.

Tune QBXML from SDK. Works for your Retell/n8n? Need WSDL snippet or deploy guide?

<div align="center">⁂</div>

[^16_1]: https://github.com/RappidDevelopment/quickbooks-js

[^16_2]: https://www.npmjs.com/package/soap


---

# I thought for quickbooks desktop we dont use QBWC?

**For remote access (your voice agent server to client's QBD), QBWC *is* the standard way—no direct REST API.** Alternatives like SDK require code on *client's PC*; QODBC enables SQL queries but needs QRemote on client machine for remote (not "API-free").[^17_1][^17_2][^17_3]

## Confirmation: Why QBWC?

- Remote, no client install beyond QBWC (free).[^17_4]
- You control logic/server-side.
- Official for web integrations.[^17_5]


## Non-QBWC Options (Client Burden)

| Method | Remote? | Setup |
| :-- | :-- | :-- |
| QODBC + QRemote | Yes (SQL) | Client installs QODBC/QRemote, exposes port; you query ODBC over TCP [^17_6][^17_7] |
| SDK DropPoint | No (local only) | Custom EXE/service on client PC [^17_1][^17_8] |
| IIF Import | Manual | Export CSV → client imports [^17_3] |

QBWC fits your SaaS (one server, multi-client). Earlier confusion from QBO "app"—Desktop skips that. Build the Node.js? Or QODBC interest?
<span style="display:none">[^17_10][^17_11][^17_12][^17_13][^17_14][^17_15][^17_16][^17_17][^17_9]</span>

<div align="center">⁂</div>

[^17_1]: https://stackoverflow.com/questions/79441855/how-to-connect-flowgear-to-quickbooks-desktop-without-web-connector-or-hosted-we

[^17_2]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^17_3]: https://satvasolutions.com/blog/best-way-to-do-integration-with-quickbooks-desktop

[^17_4]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^17_5]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started

[^17_6]: https://www.youtube.com/watch?v=YRjKz9uBdV8

[^17_7]: https://qodbc.com/using-quickbooks-remotely/

[^17_8]: https://codat.io/blog/integrating-with-quickbooks-desktop/

[^17_9]: https://www.reddit.com/r/CRM/comments/1r2zqgc/crm_that_integrates_with_quickbooks_desktop/

[^17_10]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/web-connector-and-quickbooks-online/00/1120287

[^17_11]: https://documentation.n-able.com/MSPM/userguide/en/Content/MSP-Support-remove-QB-webconnector.htm

[^17_12]: https://stackoverflow.com/questions/29245326/connect-to-quickbooks-using-qodbc-driver-remotely-via-php

[^17_13]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/quickbooks-remote-on-a-local-server/00/1584488

[^17_14]: https://www.youtube.com/watch?v=VFZh0gJ7wds

[^17_15]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/manage-users/open-company-file-remote-computer/L5MH8itFS_CA_en_CA

[^17_16]: https://satvasolutions.com/blog/quickbooks-desktop-integration-methods

[^17_17]: http://www.smatrix.com/support.html


---

# okay great, lets proceed

Great, let's proceed with QBWC setup for your voice agent's QuickBooks Desktop integration. Follow these steps to build, test, and deploy the Node.js SOAP server and .qwc.[^18_1][^18_2][^18_3]

## 1. Download Essentials

- **SDK**: developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk (QBXML refs).[^18_2]
- **QBWC**: Latest installer (2.3.0.215+) from same page or quickbooks.intuit.com (for your test).[^18_4]


## 2. Build Node.js Server

Use the full server.js code from previous (with lowdb queue). Run `npm i` \& `node server.js` → verify http://localhost:3000/qbwc?wsdl.

## 3. Local Test with Ngrok

```
ngrok http 3000 --host-header=rewrite
```

Use ngrok HTTPS URL in .qwc AppURL. POST test order to /api/order.

## 4. Generate \& Send .qwc

Customize XML (previous example, FileFormatVer 8.0 for recent QBD). Email client with:

- .qwc
- QBWC installer
- Instructions (previous copy-paste).[^18_1]


## 5. Voice Integration

Retell/n8n webhook to /api/order → queue → sync extracts QBXML → response cached at /api/inventory.

Test end-to-end on your machine first (install QBD trial?). Server ready or need tweaks?

<div align="center">⁂</div>

[^18_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^18_2]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/download-and-install-the-sdk

[^18_3]: https://github.com/RappidDevelopment/quickbooks-js

[^18_4]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_CA_en_CA


---

# how do we test with their prod desktop version?

**Test with client's prod QBD by sending them the .qwc + instructions—they connect their live company file safely (read/write based on QBXML).** No separate "sandbox" for QBD; use your dev QBD trial first, then their prod.[^19_1][^19_2][^19_3]

## Safe Prod Testing Steps

1. **Your Dev Test**: Install QBD trial (30 days) + request free dev license (Intuit support ticket: developer.intuit.com/support > NFR License).[^19_2][^19_3]
2. Install QBWC locally, .qwc with ngrok URL, approve—verify order/inventory QBXML works.
3. **Client Prod**: They use *their live QBD company file*—start with read-only QBXML (ItemQuery) to verify connection.
4. Send test .qwc (sandbox=false flag optional); they run "Update Selected" → monitor logs for errors.
5. Go live: Full create/query after verification.[^19_4][^19_5]

## Risks/Mitigation

- Backup client file first (File > Create Backup).
- Use transaction-level QBXML (SalesOrderMod if needed).
- Logs: QBWC (C:\ProgramData\Intuit\QBWebConnector\logs), your server.

Prod-ready once dev tests pass. Dev license approved yet? Or client ready for .qwc?
<span style="display:none">[^19_10][^19_11][^19_12][^19_13][^19_14][^19_15][^19_6][^19_7][^19_8][^19_9]</span>

<div align="center">⁂</div>

[^19_1]: https://stackoverflow.com/questions/21535823/testing-quickbooks-web-connector

[^19_2]: https://docs.conductor.is/qbd/dev-license

[^19_3]: https://www.apideck.com/blog/build-an-integration-with-quickbooks-desktop-in-2025

[^19_4]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/open-programs/fix-common-web-connector-errors-quickbooks-desktop/L9slolvg0_CA_en_CA

[^19_5]: https://help.adaptive.build/en/articles/9038301-quickbooks-desktop-setting-up-the-web-connector

[^19_6]: https://www.reddit.com/r/QuickBooks/comments/1lwi7qk/test_environment_for_companys_quickbooks/

[^19_7]: https://help.servicetitan.com/problem-solution/troubleshoot-quickbooks-2-0-web-connector

[^19_8]: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/administration/environment-types

[^19_9]: https://support.myworks.software/en_US/1500000440942-Web-Connector/360048701113-Using-the-Intuit-QuickBooks-Web-Connector

[^19_10]: https://stackoverflow.com/questions/28554638/ios-apns-development-sandbox-vs-production

[^19_11]: https://quickbooks.intuit.com/learn-support/en-us/help-article/install-products/set-quickbooks-web-connector/L4Vp7VI44_US_en_US

[^19_12]: https://support.databuzz.com.au/article/712-switching-between-sandbox-and-production-environments

[^19_13]: https://quickbooks.intuit.com/learn-support/en-us/account-management/can-i-get-a-free-developer-test-account-for-integration/00/1394010

[^19_14]: https://test.developer.intuit.com

[^19_15]: https://support.databuzz.com.au/article/685-switching-environments


---

# or do we need to deploy and constantly ping them to update our code?

**No, you deploy once—no constant pings or updates needed.** Client enables QBWC Auto-Run (every 5-60 min), it polls your server automatically while QBD is open/server runs.[^20_1][^20_2][^20_3]

## Production Operation

- **Client**: Sets Auto-Run in QBWC (checkbox + interval); stays logged in (server ideal). Runs silently.[^20_4][^20_3]
- **You**: Monitor your server logs/DB for syncs/errors; optional webhook from receiveResponseXML alerts client issues.
- **Code Updates**: Update your server anytime (client unaffected until new .qwc if URL changes).
- **Health Check**: Your authenticate() can return error if issues; QBWC logs failures. No "ping them"—passive.


## Monitoring Tips

- Client shares QBWC log path for troubleshooting.
- Server dashboard: Last sync per companyID.
- Alerts: Email if no sync >2x interval.[^20_5][^20_6]

Hands-off post-setup. Client server always on? Ready for code tweaks/deploy?
<span style="display:none">[^20_10][^20_11][^20_12][^20_13][^20_14][^20_15][^20_7][^20_8][^20_9]</span>

<div align="center">⁂</div>

[^20_1]: https://developer.intuit.com/app/developer/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector

[^20_2]: https://support.myworks.software/en_US/1500000440942-Web-Connector/360048701113-Using-the-Intuit-QuickBooks-Web-Connector

[^20_3]: https://success.procurify.com/en/articles/9002081-how-to-run-auto-run-with-quickbooks-desktop

[^20_4]: https://www.reddit.com/r/QuickBooks/comments/1lj2auh/quickbooks_web_connector_qbwc_autorun_issues_with/

[^20_5]: https://quickbooks.intuit.com/learn-support/en-ca/help-article/open-programs/fix-common-web-connector-errors-quickbooks-desktop/L9slolvg0_CA_en_CA

[^20_6]: https://quickbooks.intuit.com/learn-support/en-us/help-article/open-programs/fix-common-web-connector-errors-quickbooks-desktop/L9slolvg0_US_en_US

[^20_7]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/automatic-startup/00/556445

[^20_8]: https://emcosoftware.com/ping-monitor

[^20_9]: https://ping-monitor.com

[^20_10]: https://support.jobnimbus.com/quickbooks-web-connector-force-sync

[^20_11]: https://quickbooks.intuit.com/learn-support/en-us/other-questions/database-server-manager-qbcfmonitorservice-not-running-but-it-is/00/1485266

[^20_12]: https://success.procurify.com/en/articles/9002073-how-to-setup-quickbooks-desktop-web-connector

[^20_13]: https://www.youtube.com/watch?v=X3VLLow_tBE

[^20_14]: https://www.reddit.com/r/QuickBooks/comments/1hi6zox/what_processes_and_services_helpful_to_monitor/

[^20_15]: https://stackoverflow.com/questions/20754627/is-their-any-way-to-connect-qb-without-click-update-status-or-set-autorun-the-qb

