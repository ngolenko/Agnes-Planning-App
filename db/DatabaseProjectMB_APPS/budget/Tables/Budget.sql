CREATE TABLE [budget].[Budget] (
    [Id]           INT             IDENTITY (1, 1) NOT NULL,
    [CustomerId]   INT             NOT NULL,
    [Name]         NVARCHAR (50)   NOT NULL,
    [ExternalName] NVARCHAR (50)   NULL,
    [StartDate]    DATETIME        NULL,
    [EndDate]      DATETIME        NULL,
    [BudgetH]      DECIMAL (18, 2) NULL,
    [BudgetEUR]    DECIMAL (18, 2) NULL,
    CONSTRAINT [PK_Budget] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_Budget_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [budget].[Customer] ([Id])
);


GO

