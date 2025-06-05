# AgenticChat

## Getting started

- Run `yarn` to install packages over all monorepo apps
- Run `cp .env.example .env` and ensure your OpenAI API key and Bebop API keys are populated (the latter is required to get quotes)
- Run `yarn dev` to run the client and server in conjunction
- Go to `http://localhost:4200` and voila

### Troubleshooting

- If you're having `expected workspace package to exist` issues with `yarn add <somePackage>`, it is related to wrong version of yarn i.e a regression introduced somewhere around ~1.20.0.
  You will want to ensure yarn 3.5.0 is installed, which doesn't contain this bug. This can be done with `yarn set version 3.5.0` and checking with `yarn -v` the correct version is insalled
- If after many many tries, `yarn -v` still outputs 1.2x, this is probably related to corepack. Ensure you run `corepack enable` before running `yarn set version`
