;  C: capture struct definitions and function definitions.
;  Function names are nested inside function_declarator; extract.ts looks
;  for childForFieldName("name") which is absent on function_definition,
;  so function names will currently render as "<anon>".

(struct_specifier
    name: (type_identifier) @class.name) @class.def

(function_definition
    declarator: (function_declarator
        declarator: (identifier) @function.name)) @function.def
