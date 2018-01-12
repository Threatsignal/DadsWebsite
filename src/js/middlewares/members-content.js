import MembersContentController from '../controllers/members-content';


export default function(ctx, next) {
    new MembersContentController(new AuthenticationService());

    next();
}