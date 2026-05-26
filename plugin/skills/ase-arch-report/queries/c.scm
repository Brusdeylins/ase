;  C: capture struct definitions, enums, and function definitions.
;  Function names live inside function_declarator; the universal
;  nameOf() fallback in extract.ts resolves them via descendant scan.

(struct_specifier
    name: (type_identifier) @class.name) @class.def

(enum_specifier
    name: (type_identifier) @enum.name) @enum.def

(function_definition
    declarator: (function_declarator
        declarator: (identifier) @function.name)) @function.def
