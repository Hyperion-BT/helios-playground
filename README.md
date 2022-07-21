# Helios-Playground
Write, debug, and submit Helios smart contract transactions on the Cardano testnet

## Dev setup

Link the helios library:

```
$ ln -s ../helios/helios.js helios.js
```

Host static files locally (default port 8000)
```
$ sudo npm install -g local-http-server
$ ws
```

## Description of components

Reference size elements:
* `div#editor-sizer`
* `div#text-sizer`

Html classNames and IDs used in React components:
* `div#root`
* `div#app`
* `nav#tab-overview`
* `button.tab-link`
* `div#editor-tab`
* `button#new-file`
* `nav#file-overview`
* `button.file-link`
* `button#save-file`
* `div#editor`
* `div.file-editor`
* `div.line-number-column`
* `span.line-number`
* `div.file-content`
* `span.caret`
* `span.selection`
* `div.ver-scrollbar`
* `div.ver-scrollbar-thumb`
* `div.hor-scrollbar`
* `div.hor-scrollbar-thumb`
