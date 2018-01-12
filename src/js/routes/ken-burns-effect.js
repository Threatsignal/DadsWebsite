import KenBurnsController from '../controllers/ken-burns-effect';


export default function KenBurnsEffect(ctx, next) {
	new KenBurnsController();
	next();
}