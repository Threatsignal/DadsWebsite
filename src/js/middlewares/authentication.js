import AuthenticationController from '../controllers/authentication';
import AuthenticationService from '../services/authentication';

export default function(ctx, next) {
    new AuthenticationController({ authenticationService: new AuthenticationService() });

    next();
}