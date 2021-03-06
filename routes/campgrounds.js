const express = require("express"),
	  router = express.Router(),
	  Campground = require("../models/campground"),
	  Comment = require("../models/comment"),
	  Review = require("../models/review"),
	  middleware = require("../middleware"),
	  multer = require("multer"),
	  cloudinary = require('cloudinary');


var storage = multer.diskStorage({
		  filename: function(req, file, callback) {
			  callback(null, Date.now() + file.originalname);
		  }
	  });

var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

cloudinary.config({ 
  cloud_name: 'diabpe3tk', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


router.get("/", (req, res) => {
	
	Campground.find({}, (err, allcampgrounds) => {
		if(err){
			console.log(err);
		} else {
			res.render("campgrounds/index", {campgrounds: allcampgrounds});
		}
	});
});

router.post("/", middleware.isLoggedIn, upload.single('image'), (req, res) => {
	cloudinary.v2.uploader.upload(req.file.path, (err, result) => {
			req.body.campground.image = result.secure_url;
			req.body.campground.imageId = result.public_id;
			req.body.campground.author = {
				id: req.user._id,
				username: req.user.username
			}
		Campground.create(req.body.campground, (err, campground) => {
			if(err){
				req.flash('error', err.message);
				return rers.redirect('back');
			} else {
				res.redirect(`/campgrounds/${campground.id}`);
			}
		});
	});
});

router.get("/new", middleware.isLoggedIn, (req, res) => {
	res.render("campgrounds/new");
});

router.get("/:id", (req, res) => {
	Campground.findById(req.params.id).populate("comments likes").populate({
		path: "reviews",
		options: {sort: {createdAt: -1}}
	}).exec((err, found) => {
		if(err){
			console.log(err);
		} else {
			res.render("campgrounds/show", {campground: found});
		}
	});
});

router.get("/:id/edit", middleware.checkCampgroundOwnership, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		res.render("campgrounds/edit", {campground: foundCampground});
	});
});

router.put("/:id", middleware.checkCampgroundOwnership, upload.single('image'), (req, res) => {
	Campground.findById(req.params.id, async (err, campground) => {
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
              try {
                  await cloudinary.v2.uploader.destroy(campground.imageId);
                  var result = await cloudinary.v2.uploader.upload(req.file.path);
                  campground.imageId = result.public_id;
                  campground.image = result.secure_url;
              } catch(err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
              }
            }
            campground.name = req.body.campground.name;
			campground.price = req.body.campground.price;
            campground.description = req.body.campground.description;
            campground.save();
            req.flash("success","Successfully Updated!");
            res.redirect(`/campgrounds/${req.params.id}`);
        }
    });
});

router.delete("/:id", middleware.checkCampgroundOwnership, (req, res) => {
	Campground.findById(req.params.id, async (err, campground) => {
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
        }
		try {
			if(campground.imageId){
				await cloudinary.v2.uploader.destroy(campground.imageId);
			}
			await Comment.remove({"_id" : {$in: campground.comments}}, err => {
				if(err) {
					console.log(err);
					return res.redirect("/campgrounds");
				}
			});
			await Review.remove({"_id": {$in: campground.reviews}}, err => {
				if(err) {
					console.log(err);
					return res.redirect("/campgrounds");
				}
			});
			campground.remove();
			req.flash("success", "Campground deleted successfully!");
			res.redirect("/campgrounds")
		} catch(err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
	});
});

router.post("/:id/like", middleware.isLoggedIn, (req, res) => {
	Campground.findById(req.params.id, (err, foundCampground) => {
		if(err) {
			req.flash("error", err.message);
			return res.redirect("back");
		}
		var foundUserLike = foundCampground.likes.some((like) => {
			return like.equals(req.user._id);
		});
		
		if(foundUserLike) {
			foundCampground.likes.pull(req.user._id);
		} else {
			foundCampground.likes.push(req.user);
		}
		
		foundCampground.save((err) => {
			if(err) {
				console.log(err);
				req.flash("error", err.message);
				return res.redirect("back");
			}
			return res.redirect(`/campgrounds/${foundCampground._id}`);
		});
	});
});

module.exports = router;