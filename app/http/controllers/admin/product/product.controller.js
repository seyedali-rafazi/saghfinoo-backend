const Controller = require("../../controller");
const { StatusCodes: HttpStatus } = require("http-status-codes");
const mongoose = require("mongoose");
const {
  copyObject,
  deleteInvalidPropertyInObject,
} = require("../../../../../utils/functions");
const createHttpError = require("http-errors");
// const { CommentController } = require("../../comment/comment.controller");
const ObjectId = mongoose.Types.ObjectId;
const { CarGroupsSchemaModel } = require("../../../../models/carGroups");
const { UserModel } = require("../../../../models/user");
const { ProductModel } = require("../../../../models/product");
const {
  addProductSchema,
  changeCourseDiscountSchema,
} = require("../../../validators/admin/product.schema");

class ProductController extends Controller {
  async addNewProduct(req, res) {
    // const seller = req.user._id;
    await addProductSchema.validateAsync(req.body);
    const {
      title,
      description,
      slug,
      imageLink,
      carGroup,
      price,
      discount = 0,
      offPrice,
      typecars,
      capacity,
      steering,
      gasoline,
    } = req.body;

    const product = await ProductModel.create({
      title,
      description,
      slug,
      imageLink,
      carGroup,
      price,
      discount,
      offPrice,
      typecars,
      capacity,
      steering,
      gasoline,
    });
    if (!product?._id)
      throw createHttpError.InternalServerError("محصول ثبت نشد");
    return res.status(HttpStatus.CREATED).json({
      statusCode: HttpStatus.CREATED,
      data: {
        message: "محصول با موفقیت ایجاد شد",
        product,
      },
    });
  }
  async getListOfProducts(req, res) {
    let dbQuery = {};
    const user = req.user;
    const { search, carGroup, sort, capacite, offPrice } = req.query;
    if (search) dbQuery["$text"] = { $search: search };

    if (carGroup) {
      const carGroups = carGroup.split(",");
      const carGroupIds = [];
      for (const item of carGroups) {
        const { _id } = await CarGroupsSchemaModel.findOne({
          title: item,
        });
        carGroupIds.push(_id);
      }
      dbQuery["carGroup"] = {
        $in: carGroupIds,
      };
    }

    if (capacite) {
      const carGroupIds = [];
      for (const item of capacite) {
        const carGroup = await ProductModel.find({ capacity: item });
        carGroupIds.push(...carGroup.map((product) => product._id));
      }
      dbQuery["_id"] = { $in: carGroupIds };
    }

    if (offPrice) {
      dbQuery["offPrice"] = { $lte: offPrice };
    }

    const sortQuery = {};
    if (!sort) sortQuery["createdAt"] = 1;
    if (sort) {
      if (sort === "latest") sortQuery["createdAt"] = -1;
      if (sort === "earliest") sortQuery["createdAt"] = 1;
      if (sort === "popular") sortQuery["likes"] = -1;
    }

    const products = await ProductModel.find(dbQuery, {
      reviews: 0,
    })
      .populate([{ path: "carGroup", select: { title: 1, englishTitle: 1 } }])
      .sort(sortQuery);

    const transformedProducts = copyObject(products);

    const newProducts = transformedProducts.map((product) => {
      product.likesCount = product.likes.length;
      product.isLiked = false;
      if (!user) {
        product.isLiked = false;
        delete product.likes;
        return product;
      }
      if (product.likes.includes(user._id.toString())) {
        product.isLiked = true;
      }
      delete product.likes;
      return product;
    });
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        products: newProducts,
      },
    });
  }

  async getProductById(req, res) {
    const { id: productId } = req.params;
    await this.findProductById(productId);
    const product = await ProductModel.findById(productId).populate([
      {
        path: "carGroup",
        model: "carGroup",
        select: {
          title: 1,
          icon: 1,
        },
      },
    ]);

    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        product,
      },
    });
  }

  async getOneProductBySlug(req, res) {
    const { slug } = req.params;
    const product = await ProductModel.findOne({ slug }).populate([
      {
        path: "carGroup",
        model: "carGroup",
        select: {
          title: 1,
          icon: 1,
        },
      },
    ]);

    if (!product)
      throw createHttpError.NotFound("دوره ای با این مشخصات یافت نشد");

    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        product,
      },
    });
  }

  async changeProductDiscountStatus(req, res) {
    const { id } = req.params;
    await this.findProductById(id);
    await changeCourseDiscountSchema.validateAsync(req.body);
    const { discount, offPrice } = req.body;
    const result = await ProductModel.updateOne(
      { _id: id },
      { $set: { discount, offPrice } }
    );
    if (result.modifiedCount > 0) {
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: {
          message: "وضعیت تخفیف محصول فعال شد",
        },
      });
    }
    throw createHttpError.BadRequest("تغییر انجام نشد مجددا تلاش کنید");
  }
  async removeProduct(req, res) {
    const { id } = req.params;
    await this.findProductById(id);
    const deleteResult = await ProductModel.deleteOne({ _id: id });
    if (deleteResult.deletedCount == 0)
      throw createError.InternalServerError("حدف محصول انجام نشد");
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        message: "حذف محصول با موفقیت انجام شد",
      },
    });
  }
  async updateProduct(req, res) {
    const { id } = req.params;
    await this.findProductById(id);
    const data = copyObject(req.body);
    let blackListFields = ["bookmarks", "likes", "reviews"];
    deleteInvalidPropertyInObject(data, blackListFields);
    const updateProductResult = await ProductModel.updateOne(
      { _id: id },
      {
        $set: data,
      }
    );
    if (!updateProductResult.modifiedCount)
      throw new createHttpError.InternalServerError(
        "به روزرسانی محصول انجام نشد"
      );

    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        message: "به روزرسانی محصول با موفقیت انجام شد",
      },
    });
  }
  async likeProduct(req, res) {
    const { id: productId } = req.params;
    const user = req.user;
    const product = await this.findProductById(productId);
    const likedProduct = await ProductModel.findOne({
      _id: productId,
      likes: user._id,
    });
    const updateProductQuery = likedProduct
      ? { $pull: { likes: user._id } }
      : { $push: { likes: user._id } };

    const updateUserQuery = likedProduct
      ? { $pull: { likedProducts: product._id } }
      : { $push: { likedProducts: product._id } };

    const productUpdate = await ProductModel.updateOne(
      { _id: productId },
      updateProductQuery
    );
    const userUpdate = await UserModel.updateOne(
      { _id: user._id },
      updateUserQuery
    );

    if (productUpdate.modifiedCount === 0 || userUpdate.modifiedCount === 0)
      throw createHttpError.BadRequest("عملیات ناموفق بود.");

    let message;
    if (!likedProduct) {
      message = "مرسی بابت لایک تون";
    } else message = "لایک شما برداشته شد";

    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      data: {
        message,
      },
    });
  }

  async findProductById(id) {
    if (!mongoose.isValidObjectId(id))
      throw createHttpError.BadRequest("شناسه محصول ارسال شده صحیح نمیباشد");
    const product = await ProductModel.findById(id);
    if (!product) throw createHttpError.NotFound("محصولی یافت نشد.");
    return product;
  }
}

module.exports = {
  ProductController: new ProductController(),
};
