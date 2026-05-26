;  JavaScript: capture classes and their methods, plus top-level functions.

(class_declaration
    name: (identifier) @class.name) @class.def

(method_definition
    name: (property_identifier) @method.name) @method.def

(function_declaration
    name: (identifier) @function.name) @function.def
