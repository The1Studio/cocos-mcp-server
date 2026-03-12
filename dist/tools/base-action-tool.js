"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseActionTool = void 0;
const types_1 = require("../types");
/**
 * Base class for action-based tools.
 * Subclasses define actions in a map and the base class handles routing.
 */
class BaseActionTool {
    async execute(action, args) {
        const handler = this.actionHandlers[action];
        if (!handler) {
            return (0, types_1.errorResult)(`Unknown action '${action}' for tool '${this.name}'. ` +
                `Available actions: ${this.actions.join(', ')}`);
        }
        try {
            return await handler.call(this, args);
        }
        catch (err) {
            return (0, types_1.errorResult)(`${this.name}.${action} failed: ${err.message}`);
        }
    }
}
exports.BaseActionTool = BaseActionTool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1hY3Rpb24tdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9iYXNlLWFjdGlvbi10b29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUE2RTtBQUU3RTs7O0dBR0c7QUFDSCxNQUFzQixjQUFjO0lBU2hDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBYyxFQUFFLElBQXlCO1FBQ25ELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ1gsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsbUJBQW1CLE1BQU0sZUFBZSxJQUFJLENBQUMsSUFBSSxLQUFLO2dCQUN0RCxzQkFBc0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDbEQsQ0FBQztRQUNOLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDRCxPQUFPLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdkJELHdDQXVCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xFeGVjdXRvciwgQWN0aW9uVG9vbFJlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgYWN0aW9uLWJhc2VkIHRvb2xzLlxuICogU3ViY2xhc3NlcyBkZWZpbmUgYWN0aW9ucyBpbiBhIG1hcCBhbmQgdGhlIGJhc2UgY2xhc3MgaGFuZGxlcyByb3V0aW5nLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUFjdGlvblRvb2wgaW1wbGVtZW50cyBBY3Rpb25Ub29sRXhlY3V0b3Ige1xuICAgIGFic3RyYWN0IHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICBhYnN0cmFjdCByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIGFic3RyYWN0IHJlYWRvbmx5IGlucHV0U2NoZW1hOiBvYmplY3Q7XG4gICAgYWJzdHJhY3QgcmVhZG9ubHkgYWN0aW9uczogc3RyaW5nW107XG5cbiAgICAvKiogTWFwIG9mIGFjdGlvbiBuYW1lIC0+IGhhbmRsZXIgbWV0aG9kICovXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj47XG5cbiAgICBhc3luYyBleGVjdXRlKGFjdGlvbjogc3RyaW5nLCBhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl07XG4gICAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgIGBVbmtub3duIGFjdGlvbiAnJHthY3Rpb259JyBmb3IgdG9vbCAnJHt0aGlzLm5hbWV9Jy4gYCArXG4gICAgICAgICAgICAgICAgYEF2YWlsYWJsZSBhY3Rpb25zOiAke3RoaXMuYWN0aW9ucy5qb2luKCcsICcpfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVyLmNhbGwodGhpcywgYXJncyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYCR7dGhpcy5uYW1lfS4ke2FjdGlvbn0gZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19