import mongoose, { Schema, mongo } from "mongoose"

const subscriptionSchema = mongoose.Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true})

export const Subscription = mongoose.model("Subscriptions", subscriptionSchema)