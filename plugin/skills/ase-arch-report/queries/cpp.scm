;  C++: capture classes, structs, enums, and function/method definitions.

(class_specifier
    name: (type_identifier) @class.name) @class.def

(struct_specifier
    name: (type_identifier) @class.name) @class.def

(enum_specifier
    name: (type_identifier) @enum.name) @enum.def

(function_definition
    declarator: (function_declarator
        declarator: (identifier) @function.name)) @function.def

(function_definition
    declarator: (function_declarator
        declarator: (field_identifier) @method.name)) @method.def
