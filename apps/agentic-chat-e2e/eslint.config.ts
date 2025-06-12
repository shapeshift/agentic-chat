import playwright from 'eslint-plugin-playwright'

import baseConfig from '../../eslint.config'

export default [...baseConfig, playwright.configs['flat/recommended']]
