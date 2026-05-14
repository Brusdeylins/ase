;  TypeScript: capture exported classes, interfaces, and their members.
;  Note: tree-sitter-typescript distinguishes `class_declaration` and
;  `interface_declaration` at the top level.

(class_declaration
    name: (type_identifier) @class.name) @class.def

(interface_declaration
    name: (type_identifier) @interface.name) @interface.def

(method_definition
    name: (property_identifier) @method.name) @method.def

(method_signature
    name: (property_identifier) @method.sig.name) @method.sig.def
