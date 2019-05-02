## Ember intl `vscode` extension

Shamefully borrowed from [angular-i18n-validator](https://marketplace.visualstudio.com/items?itemName=OleksandrReznichenko.angular-i18n-validator)

Extension for validating i18n for Ember cli projects with adding peace of functionality for seeing and navigating to translations.. Takes into account current context with showing and navigating only to relevant translations. 

Works with:
- ember-intl (json format)
- ember-i18n
	* In order to get this to work, I needed to make the js object that ember-i18n returns json. i.e be sure to add quotes to all keys and values


Supported features:
- Validating `handlebar` templates against translation files
- Hover Popup with showing available translation
- `IntelliSense`
- `Go To` particular translation file from the Hover Popup
- `Generate translation unit(-s)` for a single or bulk translation units generating
- `Remove translation` from both the template and the translation file

Features planned but not yet supported:
- `Yaml` support for ember-intl
- `Go To Definition` from html template to relevant translation file
- `Find All References` for showing translation unit usages across `html` templates
- `Rename` applys changes for both `html` template and translation file
