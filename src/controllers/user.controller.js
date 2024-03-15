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
    console.log(req.user._id)
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
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {email, oldpassword, newpassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldpassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Incorrect old password")
    }
    user.password = newpassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changes successfully"))
})
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "current user fetched successfully")
    )
})
const updateAccountDetails = asyncHandler(async (req, res) =>{
    const {fullName, email} = req.body
    if(!fullName && !email) {
        throw new ApiError(400, "Alll fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, 
                email
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})
const updateUserCover = asyncHandler(async (req, res) => {
    const coverLocalPath = req.file?.path

    if(!coverLocalPath){
        throw new ApiError(400, "Cover file is missing")
    }
    const cover = await uploadOnCloudinary(coverLocalPath)
    if(!cover.url){
        throw new ApiError(400, "Error while uploading cover")
    }
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: cover.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")
    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image updated successfully")
    )
})
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
                }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404, "channel does not exist")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})
const getWatchHistory = asyncHandler(async (req, res) => {
    //req.user._id return 
    //something like this "new ObjectId('65ef0531e0db48911348f4bc')"
    //but it directly passed in to find in database as mongoose takes care of back processes of conversion
    //but when using aggregate the data values are passed directly without interference of mongoose
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watch history",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    userName: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ],
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].watchHistory,
            "watch history fetched successfully"
        )
    )
})
export {registerUser, loginUser, logoutUser, refreshAccessToken, 
    changeCurrentPassword, getCurrentUser, updateAccountDetails, 
    updateUserAvatar, updateUserCover, getUserChannelProfile, getWatchHistory}
