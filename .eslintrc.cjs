/* eslint-disable */
module.exports = {
    extends: [
        "eslint:recommended",
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript"
    ],
    parser: "@typescript-eslint/parser",
    plugins: [
        "@typescript-eslint",
        "prettier"
    ],
    ignorePatterns: ["*.d.ts"],
    rules: {
        "no-case-declarations": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_"
            }
        ],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-empty-interface": "off",
        "import/no-named-as-default-member": "off",
        "import/no-extraneous-dependencies": "error",
        "prettier/prettier": "error",
        "@typescript-eslint/no-require-imports": "error",
        "import/no-unresolved": "off",
        "prettier/prettier": "error",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "import/default": "off",
        eqeqeq: ["error", "always"],
        "no-restricted-syntax": [
            "error",
            {
                selector:
                    "CallExpression[callee.name='describe'] MemberExpression[object.type='ThisExpression'][property.name='timeout']",
                message: "Manual timeouts in Mocha tests are not allowed."
            }
        ]
    },
    settings: {
        "import/resolver": {
            typescript: true,
            node: true
        }
    },
    root: true
};
