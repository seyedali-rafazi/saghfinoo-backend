const { verifyAccessToken } = require("../http/middlewares/user.middleware");
const { adminRoutes } = require("./admin/admin.routes");
const { cartRoutes } = require("./cart");
const { houseGroupRoutes } = require("./houseGroup");
const { paymentRoutes } = require("./payment");
const { productRoutes } = require("./product");
const { userAuthRoutes } = require("./user.routes");

const router = require("express").Router();

router.use("/user", userAuthRoutes);
router.use("/housegroup", houseGroupRoutes);
router.use("/product", productRoutes);
router.use("/payment", paymentRoutes);
router.use("/cart", verifyAccessToken, cartRoutes);
router.use("/admin", verifyAccessToken, adminRoutes);

module.exports = {
  allRoutes: router,
};
