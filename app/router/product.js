const expressAsyncHandler = require("express-async-handler");
const {
  ProductController,
} = require("../http/controllers/admin/product/product.controller");
const {
  decideAuthMiddleware,
  verifyAccessToken,
} = require("../http/middlewares/user.middleware");

const router = require("express").Router();

router.get("/list", expressAsyncHandler(ProductController.getListOfProducts));


router.post(
  "/like/:id",
  verifyAccessToken,
  expressAsyncHandler(ProductController.likeProduct)
);

router.get(
  "/:id",
  decideAuthMiddleware,
  expressAsyncHandler(ProductController.getProductById)
);
module.exports = {
  productRoutes: router,
};
