

export default class Router extends Middleware {
    constructor() {
        super(route);
        this._bindRoutes();
        route.start({click: false});
    }

}