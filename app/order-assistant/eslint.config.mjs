import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
    // vendored marked (MIT), see webapp/thirdparty/marked.js
    { ignores: ['webapp/thirdparty/**'] },
    ...fioriTools.configs.recommended
];
