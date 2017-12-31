import MembersContentController from '../controllers/members-content';
import AuthenticationService from '../services/authentication';

export default function(ctx, next) {
    new MembersContentController(new AuthenticationService());

    next();
}