CREATE TABLE [budget].[Customer] (
    [Id]           INT            NOT NULL,
    [CustomerName] NVARCHAR (255) NULL,
    [IsActive]     BIT            NOT NULL CONSTRAINT [DF_Customer_IsActive] DEFAULT ((1)),
    CONSTRAINT [PK_Customer] PRIMARY KEY CLUSTERED ([Id] ASC)
);


GO

