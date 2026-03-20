import { AxiosError } from "axios";
import { axiosInstance } from "./axios.config";
interface ApiError {
    message : string ,
    statusCode : number,
    code? : string

}
const handleError = (error: unknown) => {
    if(error instanceof AxiosError){
        const apiError : ApiError = {
            message :
              (error.response?.data as any)?.message ||
              (error.response?.data as any)?.error ||
              "An error occurred",
            statusCode : error.response?.status || 500,
            code : error.code
        }
        const err = new Error(apiError.message)
        ;(err as any).statusCode = apiError.statusCode
        ;(err as any).code = apiError.code
        throw err
    }

}
export const ApiClient = {
    async get<T>(endPoint: string): Promise<T>{
    try {
        const res = await axiosInstance.get<T>(`${endPoint}`);
        return res.data;
    } catch (error) {
        console.error('Error in GET request:', error);
        handleError(error);
        throw error as any
        
    }
    },

async post<T , U = unknown>(endPoint: string, data: U): Promise<T>{
    try {
        const res = await axiosInstance.post<T>(`${endPoint}`, data);
        return res.data;
    } catch (error) {
        console.error('Error in POST request:', error);
        handleError(error);
        throw error as any
    }
},
async patch<T , U = unknown>(endPoint: string, data: U): Promise<T>{
    try {
        const res = await axiosInstance.patch<T>(`${endPoint}`, data);
        return res.data;
    } catch (error) {
        handleError(error);
        throw error as any
    }
}
}
