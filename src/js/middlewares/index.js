import NavigationMiddleware from './navigation';
import AuthenticationMiddleware from './authentication';
import MembersContentMiddleware from './members-content';

export default class Middleware {
    constructor(page) {
        page('*', NavigationMiddleware);
        page('*', AuthenticationMiddleware);
        page('*', MembersContentMiddleware);
    }
}