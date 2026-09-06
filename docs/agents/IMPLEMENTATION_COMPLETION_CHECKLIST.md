# ELS-AI Step-by-Step Completion Checklist

Use this checklist with `MASTER_GUIDE.md` to ensure no partial implementation is left.

## Step 0: Canonical Alignment
- [ ] Ports and gateway mappings are consistent across docs and code
- [ ] Folder structure references match current repo layout
- [ ] Role naming is consistent (`active_role` / `activeRole`)

## Step 1: Database & Auth
- [ ] User/role/org schema implemented
- [ ] Refresh token rotation implemented
- [ ] Active role persistence endpoint implemented
- [ ] Env validation in auth-service startup

## Step 2: Backend Services
- [ ] Gateway routes proxy all service prefixes correctly
- [ ] Quiz and attempt APIs are implemented and stable
- [ ] Health endpoints available for each service
- [ ] Port and service startup handled through scripts

## Step 3: Mobile Role UX
- [ ] Profile switch updates tabs/screens without restart
- [ ] Role-specific screen segregation enforced
- [ ] Role-based data loading implemented
- [ ] API base URL comes only from env

## Step 4: AI Agents
- [ ] All 6 agents are defined (Context, Content, Question, Assessment, Recommendation, Report)
- [ ] JSON output schema validation is enforced
- [ ] Teacher review/edit/publish workflow implemented
- [ ] Safety and fallback behaviors are defined

## Step 5: Operations and Release
- [ ] Local start/stop/restart scripts are stable
- [ ] Typecheck and test gates pass before release
- [ ] Secrets are not hardcoded or committed
- [ ] Environment files exist for required stages
