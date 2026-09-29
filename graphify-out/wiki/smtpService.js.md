# smtpService.js

> 24 nodes · cohesion 0.17

## Key Concepts

- **smtpService.js** (20 connections) — `server/services/smtpService.js`
- **classifySmtpError()** (17 connections) — `server/services/smtpService.js`
- **test_smtp_pipeline.js** (10 connections) — `server/test_smtp_pipeline.js`
- **test_smtp_resilience.js** (10 connections) — `server/test_smtp_resilience.js`
- **sendEmailMessageWithRetry()** (9 connections) — `server/services/smtpService.js`
- **dispatchCampaign()** (6 connections) — `server/services/smtpService.js`
- **runTests()** (6 connections) — `server/test_smtp_pipeline.js`
- **createTransporter()** (5 connections) — `server/services/smtpService.js`
- **nodemailer** (4 connections) — `server/package.json`
- **extractSmtpCode()** (4 connections) — `server/services/smtpService.js`
- **sendEmailMessage()** (4 connections) — `server/services/smtpService.js`
- **testSmtpConnection()** (4 connections) — `server/services/smtpService.js`
- **runTests()** (4 connections) — `server/test_smtp_resilience.js`
- **worker()** (2 connections) — `server/services/smtpService.js`
- **fs** (1 connections) — `server/services/smtpService.js`
- **RFC-5321** (1 connections) — `server/services/smtpService.js`
- **nodemailer** (1 connections) — `server/services/smtpService.js`
- **path** (1 connections) — `server/services/smtpService.js`
- **assert** (1 connections) — `server/test_smtp_pipeline.js`
- **{
  classifySmtpError,
  sendEmailMessageWithRetry,
  dispatchCampaign,
  extractSmtpCode
}** (1 connections) — `server/test_smtp_pipeline.js`
- **RFC-5321** (1 connections) — `server/test_smtp_pipeline.js`
- **assert** (1 connections) — `server/test_smtp_resilience.js`
- **{
  classifySmtpError,
  createTransporter,
  sendEmailMessageWithRetry
}** (1 connections) — `server/test_smtp_resilience.js`
- **nodemailer** (1 connections) — `server/test_smtp_resilience.js`

## Relationships

- [index.js](index.js.md) (6 shared connections)
- [App.jsx](App.jsx.md) (2 shared connections)
- [test_e2e_pipeline.js](test_e2e_pipeline.js.md) (2 shared connections)
- [test_e2e_suite.js](test_e2e_suite.js.md) (2 shared connections)
- [decrypt](decrypt.md) (2 shared connections)
- [ref_assert](ref_assert.md) (2 shared connections)
- [server/package.json](server-package.json.md) (1 shared connections)
- [ref_fs](ref_fs.md) (1 shared connections)
- [ref_path](ref_path.md) (1 shared connections)
- [3.1 Multi-Provider AI Studio (`aiService.js`, `copilotService.js`)](3.1_Multi-Provider_AI_Studio_`aiService.js`,_`copilotService.js`.md) (1 shared connections)
- [2. Detailed Ticket-by-Ticket Diff Review](2._Detailed_Ticket-by-Ticket_Diff_Review.md) (1 shared connections)
- [Detailed Cycle 3 Shipped Ticket Specifications](Detailed_Cycle_3_Shipped_Ticket_Specifications.md) (1 shared connections)

## Source Files

- `server/package.json`
- `server/services/smtpService.js`
- `server/test_smtp_pipeline.js`
- `server/test_smtp_resilience.js`

## Audit Trail

- EXTRACTED: 58 (84%)
- INFERRED: 11 (16%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*