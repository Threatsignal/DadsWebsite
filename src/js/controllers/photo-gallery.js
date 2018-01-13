
//This import order matters, don't change it or app could break.
import Helper from './dependencies/blueimp-helper';
import PhotoSwipe from './dependencies/blueimp-gallery';
import Fullscreen from './dependencies/blueimp-gallery-fullscreen';

export default class PhotoGalleryController{
	constructor() {
		this.process();
	}
	
	//documentation for api methods used in process
	//https://www.flickr.com/services/api/explore/flickr.photosets.getPhotos
	
	//To get album list
	//https://www.flickr.com/services/api/explore/flickr.photosets.getList
	process() {
		let galleryController = this;
		$(document).ready(function(){
			// Load demo images from flickr:
			$.ajax({
				url: 'https://api.flickr.com/services/rest/',
				data: {
					format: 'json',
					user_id: '154596101@N02',
					method: 'flickr.photosets.getList',
					api_key: '2360ff92cabc49f59a9ceaa136a0fbcb'
				},
				dataType: 'jsonp',
				jsonp: 'jsoncallback'
			}).done((result) => {
				//checking to make sure request with api was successful....
				if(result.stat === "fail"){
					console.log("Error occured!");
					console.log(result);
					galleryController.handleError("An Error occurred, Please try refreshing the browser.");
					//handle error here.....
					$('.loader').hide();
				}
				else {
					let albumContainer = $('#albumContainer');
					let albumElem;
					let baseUrl;
					let selectYearArray = [];
					let addToTagArray = true;
					$.each(result.photosets.photoset, (index, photo) => {
						baseUrl = 'https://c1.staticflickr.com/' + photo.farm + '/' +
							photo.server + '/' + photo.primary + '_' + photo.secret;
						//Building the album image containers dynamically through ajax call.
						albumElem = '<li><div class="photoAlbum view photo-list-album-view awake" id="' + photo.id + '" style="transform: translate(0px, 8px);width: 240px;height: 240px;background-image:url(' + baseUrl + '_n.jpg)">';
						albumElem += '<a class="interaction-view avatar photo-list-album album ginormous" href="#" title="' + photo.title._content + '" data-rapid_p="65">';
						albumElem += '<div class="photo-list-album-interaction dark has-actions" data-albumid="' + photo.id + '" >';
						albumElem += '<a class="overlay" href="#" data-rapid_p="87"></a>';
						albumElem += '<div class="interaction-bar">';
						albumElem += '<div class="metadata">';
						albumElem += '<h4 class="albumTitle">' + photo.title._content + '</h4>';
						let albumTags = photo.description._content;
						let albumTagArray = albumTags.split(',');
						
						for(let i=0; i<albumTagArray.length; i++){
							if(albumTagArray[i].includes("year:")){
								let subAlbumArray = albumTagArray[i].split(":");
								albumElem += '<h4 class="albumYear">' + subAlbumArray[1].trim() + '</h4>';
								for(let j=0; j<selectYearArray.length; j++){
									if(subAlbumArray[1].trim().toUpperCase() === selectYearArray[j].toUpperCase()){
										addToTagArray = false;
										break;
									}
									addToTagArray = true;
								}
								if(addToTagArray){
									selectYearArray.push(subAlbumArray[1].trim());
								}
							}
							else if(albumTagArray[i].includes("school:")){
								let subAlbumArray = albumTagArray[i].split(":");
								albumElem += '<h4 class="albumSchool">' + subAlbumArray[1].trim() + '</h4>';
							}
							else if(albumTagArray[i].includes("event:")){
								let subAlbumArray = albumTagArray[i].split(":");
								albumElem += '<h4 class="albumEvent">' + subAlbumArray[1].trim() + '</h4>';
							}
							else {
								albumElem += '<h4 class="albumTag" style="display:none;">' + albumTagArray[i].trim() + '</h4>';
							}
						}
						let photoString;
						if (photo.photos > 1) {
							photoString = "photos";
						} else {
							photoString = "photo";
						}
						albumElem += '<span class="album-photo-count secondary">' + photo.photos + ' ' + photoString + '</span>';
						albumElem += '</div></div></div></a></div></li>';
						$('#list').append(albumElem);
						albumElem = "";
					});//end Each
					//Sorting years into order from least to greatest.
					selectYearArray = galleryController.bubbleSortArray(selectYearArray);
					//Add bubble sort method here.
					for(let i=0; i<selectYearArray.length; i++){
						let optionElem = '<option value ="'+selectYearArray[i]+'">'+selectYearArray[i]+'</option>';
						$('#filter-tags').append(optionElem);
					}
					
					$('.photoAlbum').click(function (event) {
						event.preventDefault();
						$('#closeButton').show("slow");
						$('#albumContainer').hide("slow");
						$('.loader').show("fast");
						$.ajax({
							url: 'https://api.flickr.com/services/rest/',
							data: {
								format: 'json',
								photoset_id: this.id,
								user_id: '154596101@N02',
								method: 'flickr.photosets.getPhotos',
								api_key: '2360ff92cabc49f59a9ceaa136a0fbcb'
							},
							dataType: 'jsonp',
							jsonp: 'jsoncallback'
						}).done(function (result) {
							if(result.stat === "fail"){
								console.log("Error occured while grabbing photo album!");
								console.log(result);
								galleryController.handleError("An Error occurred, Please try refreshing the browser.");
							}
							else {
								//console.log(result);
								let carouselLinks = [],
									linksContainer = $('#links').empty(),
									baseUrl;
								// Add the demo images as links with thumbnails to the page:
								$.each(result.photoset.photo, function (index, photo) {
									//$.each(result.photos.photo, function (index, photo) {
									baseUrl = 'https://farm' + photo.farm + '.static.flickr.com/' +
										photo.server + '/' + photo.id + '_' + photo.secret
									$('<a/>')
										.append($('<img>').prop('src', baseUrl + '_s.jpg'))
										.prop('href', baseUrl + '_b.jpg')
										.prop('title', photo.title)
										.attr('data-gallery', '')
										.appendTo(linksContainer);
									carouselLinks.push({
										href: baseUrl + '_c.jpg',
										title: photo.title
									});
								});
								// Initialize the Gallery as image carousel:
								blueimp.Gallery(carouselLinks, {
									container: '#blueimp-image-carousel',
									carousel: true
								});
								$('.loader').hide("fast");
								$('#blueimp-image-carousel').show("slow");
								$('#links').show("slow");
							}
						}).fail((error) => {
							console.log("The inner request failed with");
							console.log(error);
							galleryController.handleError("An Error occurred, Please try refreshing the browser.");
						}); //End ajax call.
						//Hooking up lightBox links to onclick function
						document.getElementById('links').onclick = function (event) {
							event = event || window.event;
							let target = event.target || event.srcElement,
								link = target.src ? target.parentNode : target,
								options = {index: link, event: event},
								links = this.getElementsByTagName('a');
							blueimp.Gallery(links, options);
						}; //end hooking up lightbox onclick.
					});//End onClick.
					//Add search etc here?
					//Grabbing the list.js script dynamically after sucessfully hit flickr api.
					$.getScript("//cdnjs.cloudflare.com/ajax/libs/list.js/1.5.0/list.min.js").done(() =>{
						//This instantiates our pagination and search functionality 
						let monkeyList = new List('albumContainer', {
							valueNames: ['albumTitle', 'albumYear', 'albumSchool', 'albumTag', 'albumEvent'],
							page: 6,
							pagination: true
						});
						$('#filter-tags').change(function() {
							console.log($('#filter-tags').val());
							let selectedOption = $('#filter-tags').val();
							monkeyList.filter(function(item) {
								if(selectedOption === "Select Year"){
									return true;
								}
								else if(item.values().albumYear.trim() == selectedOption) {
									return true;
								} else {
									return false;
								}
							});
							return false;
						});
					});
					$('.loader').hide();
				} //End else (if no error)
			}).fail( (error) =>{
				console.log("the request failed and threw an error");
				console.log(error);
				galleryController.handleError("An Error occurred, Please try refreshing the browser.");
			}); //End get photo Albums ajax call
			
			$('#closeButton').click(function(event){
				event.preventDefault();
				$('#closeButton').hide("slow");
				$('#albumContainer').show("slow");
				$('#blueimp-image-carousel').hide("slow");
				$('#links').hide("slow");
			});
			
		}); //End document.ready
	}//end process
	
	bubbleSortArray(array){
		let length = array.length;
		for(let i=0; i<length; i++){
			for(let j=0; j<(length -i -1); j++){
				if(array[j] > array[j+1]){
					let temp = array[j];
					array[j] = array[j+1];
					array[j+1] = temp;
				}
			}
		}
		return array;
	}
	
	handleError(errorMsg){
		$('#albumContainer').hide();
		$('#errorMessage').text(errorMsg);
		$('#errorMessage').show();
	}
	
}