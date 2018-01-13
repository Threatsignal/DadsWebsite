import route from 'page';
import Middleware from '../middlewares';

import KenBurnsEffect from './ken-burns-effect';
import PhotoGallery from './photo-gallery';

export default class Router extends Middleware {
	constructor() {
		super(route);
		this._bindRoutes();
		route.start({click: false});
	}
	
	
	_bindRoutes() {
		route('/', KenBurnsEffect);
		route('/gallery/', PhotoGallery);
		
	}
	
	refresh() {
		route(window.location.pathname);
	}
	
}