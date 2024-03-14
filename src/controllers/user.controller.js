import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";  
const registerUser = asyncHandler(async (req, res) => {
    // get user detail from frontend
    // validation of details entered
    // check if user already exists
    // check if avatar provided
    //upload to cloudinary
    // create user object - create entry in db
    // remove password and refresh token from response
    // check if user created or not
    // return res
    const {fullName, email, username, password} = req.body
    console.log("email: ", email)
    console.log("Response: ", req.body)
    if([fullName, email, password, username].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required")        
    }

    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if(existingUser){
        throw new ApiError(409, "User with email or username already exits")
    }
    console.log("Files: ", req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    console.log("Avatar: ", req.files?.avatar[0])
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    console.log("cloudinary: ", avatar)
    if(!avatar){
        throw new ApiError(400, "avatar is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )
})
const generateAccessandRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave : false })
        return {accessToken, refreshToken} 
    } catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}
const loginUser = asyncHandler(async (req, res) => {
    // req.body -> data
    //username or email
    // find user
    // check password
    // access and refresh token  generate
    // send cookies

    const {email, username, password} = req.body

    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }
    
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(!user){
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User Credentials")
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged in successfully"
        )
    )
})
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },  
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})
const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const crefreshtoken = req.cookies.refreshToken || req.body.refreshToken
        if(!crefreshtoken){
            throw new ApiError(401, "Unauthorised request")
        }
        const decodedtoken = await jwt.verify(crefreshtoken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedtoken?._id)
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
        if(crefreshtoken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken}, "Access Token refreshed")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})
export {registerUser, loginUser, logoutUser, refreshAccessToken}