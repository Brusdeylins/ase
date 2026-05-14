;  C#: capture classes, interfaces, records, and their methods.

(class_declaration
    name: (identifier) @class.name) @class.def

(interface_declaration
    name: (identifier) @interface.name) @interface.def

(record_declaration
    name: (identifier) @class.name) @class.def

(method_declaration
    name: (identifier) @method.name) @method.def
