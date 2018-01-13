import PhotoGalleryController from '../controllers/photo-gallery';

export default function PhotoGallery(ctx, next) {
	new PhotoGalleryController();
	
	next();
}