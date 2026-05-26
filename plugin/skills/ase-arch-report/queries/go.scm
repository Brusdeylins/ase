;  Go: capture struct/interface type specs and method/function declarations.

(type_spec
    name: (type_identifier) @class.name
    type: (struct_type)) @class.def

(type_spec
    name: (type_identifier) @interface.name
    type: (interface_type)) @interface.def

(method_declaration
    name: (field_identifier) @method.name) @method.def

(function_declaration
    name: (identifier) @function.name) @function.def
