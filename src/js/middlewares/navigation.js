import NavigationController from '../controllers/navigation';

export default function(ctx, next) {
    new NavigationController();
    
    next();
}