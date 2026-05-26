;  TypeScript: capture exported classes (including abstract), interfaces, and
;  their members + heritage clauses.

(class_declaration
    name: (type_identifier) @class.name) @class.def

(abstract_class_declaration
    name: (type_identifier) @class.name) @class.def

(interface_declaration
    name: (type_identifier) @interface.name) @interface.def

(enum_declaration
    name: (identifier) @enum.name) @enum.def

(method_definition
    name: (property_identifier) @method.name) @method.def

(method_signature
    name: (property_identifier) @method.sig.name) @method.sig.def

(class_heritage) @heritage

(extends_type_clause) @extends.clause
