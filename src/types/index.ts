export interface Product{id:string;categoryId:string;name:string;subtitle:string;price:number;originalPrice:number;stock:number;sales:number;tag:string;image:string;weight:number}
export interface Category{id:string;name:string} export interface CartLine{product:Product;quantity:number} export interface Cart{items:CartLine[];productAmount:number;totalQuantity:number;deliveryThreshold:number}
export interface Address{id:string;campusName:string;buildingName:string;floor:number;room:string;contactName:string;phone:string;isDefault:boolean}
export interface Order{id:string;orderNo:string;status:string;statusText:string;createdAt:string;payableAmount:number;productAmount:number;deliveryFee:number;discount:number;items:CartLine[];address:Address;estimatedArrival:string;timeline:Array<{key:string;title:string;description:string;time?:string;done:boolean}>}
export interface ApiResult<T>{code:number;message:string;data:T;timestamp:string}
