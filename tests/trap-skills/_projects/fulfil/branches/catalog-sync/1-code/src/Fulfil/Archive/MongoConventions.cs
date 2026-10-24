using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.Serializers;

namespace Fulfil.Archive;

public static class MongoConventions
{
    public static void Register()
    {
        BsonSerializer.TryRegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));
        BsonSerializer.TryRegisterSerializer(new DecimalSerializer(BsonType.Decimal128));
        BsonSerializer.TryRegisterSerializer(new DateTimeOffsetSerializer(BsonType.DateTime));

        var pack = new ConventionPack
        {
            new CamelCaseElementNameConvention(),
            new EnumRepresentationConvention(BsonType.String),
            new IgnoreExtraElementsConvention(true),
        };
        ConventionRegistry.Register("fulfil", pack, t => t.Namespace?.StartsWith("Fulfil") == true);
    }
}
