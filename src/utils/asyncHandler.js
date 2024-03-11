const asyncHandler = (fn) => async(req, res, next) => {
    try{
        return await fn(req, res, next)
    } catch(error){
        res.status(err.code || 500).json({
            success: false,
            message: err.message
        })
    }
}

export {asyncHandler}

// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async => {} 