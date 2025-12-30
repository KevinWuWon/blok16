import pluginVue from 'eslint-plugin-vue'
import vueTsConfig from '@vue/eslint-config-typescript'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'convex/_generated/**']
  },
  ...pluginVue.configs['flat/recommended'],
  ...vueTsConfig(),
  {
    files: ['**/*.vue', '**/*.ts'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
]
